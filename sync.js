// 跨设备同步：把各教程站存在 localStorage 里的进度、词本、笔记，按「同步码」和服务器上的那一份合并。
// 各教程站的共享脚本在页面加载后引入本文件（/_home/sync.js）；没有设置同步码时，它不发任何请求。
//
// 做法：不改各站读写 localStorage 的代码。本文件自己记一份「上次同步后的样子」（sync-base），
// 每次同步时拿当前的 localStorage 和它比，找出这台设备上改过、删过的键，带上时间发给服务器；
// 服务器逐键合并（时间新的赢），把合并后的全部键发回来；再把别的设备改过的键写进 localStorage。
// 删除也要同步，所以删掉的键以 [时间, null] 的形式留一个标记。
//
// 只同步各教程站自己的键（按前缀），主题（深/浅色）不同步：那是每台设备自己的事。
// 本文件自己的键：sync-code（同步码）、sync-base（上次同步后的样子）、sync-at（上次成功的时间）、sync-api（调试时改服务地址）。
(() => {
  const PREFIXES = ["ostep-", "aposd-", "ggs-", "fr-", "hw-", "po-", "ds-", "home-"];
  const wanted = (k) => PREFIXES.some((p) => k.startsWith(p)) && !k.endsWith("-theme");
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); return true; } catch { return false; } },
  };
  const API = ls.get("sync-api") || "/api/sync";
  const ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz"; // Crockford base32：没有 i l o u，不容易抄错
  const normCode = (s) => String(s || "").toLowerCase().replace(/[^0-9a-z]/g, "").replace(/[il]/g, "1").replace(/o/g, "0");
  const validCode = (c) => /^[0-9a-hjkmnp-tv-z]{26}$/.test(c);
  const pretty = (c) => c.replace(/(.{5})(?=.)/g, "$1-").toUpperCase();
  const newCode = () => [...crypto.getRandomValues(new Uint8Array(26))].map((b) => ALPHABET[b & 31]).join("");

  const state = { busy: false, error: "", applied: 0 };
  const emit = () => document.dispatchEvent(new CustomEvent("tsync"));
  const code = () => { const c = ls.get("sync-code"); return validCode(c || "") ? c : null; };
  const base = () => { try { return JSON.parse(ls.get("sync-base")) || {}; } catch { return {}; } };

  function current() {
    const out = {};
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (wanted(k)) out[k] = localStorage.getItem(k); } } catch {}
    return out;
  }
  // 这台设备上次同步以后改了什么。第一次同步（还没有 base）时，本机已有的数据一律算「很早以前」：
  // 这样新设备加入时，服务器上已有的记录不会被本机的旧数据盖掉，本机独有的键照样会传上去。
  function changes() {
    const b = base(), cur = current(), first = ls.get("sync-base") == null, t = first ? 1 : Date.now(), out = {};
    for (const [k, v] of Object.entries(cur)) if (!b[k] || b[k][1] !== v) out[k] = [t, v];
    for (const [k, tv] of Object.entries(b)) if (tv[1] != null && !(k in cur) && wanted(k)) out[k] = [t, null];
    return out;
  }
  async function call(method, c, body, create) {
    const headers = { "X-Sync-Code": c };
    if (body) headers["Content-Type"] = "application/json";
    if (create) headers["X-Sync-Create"] = "1";
    const r = await fetch(API, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: "no-store", keepalive: !!body && JSON.stringify(body).length < 60000 });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j.error || `同步服务返回 ${r.status}`), { status: r.status });
    return j.keys || {};
  }
  // 把服务器合并后的结果写回本机。返回改动了几个键。
  function apply(keys) {
    const cur = current(); let n = 0;
    for (const [k, [, v]] of Object.entries(keys)) {
      if (!wanted(k)) continue;
      if (v == null ? k in cur : cur[k] !== v) { if (ls.set(k, v)) n++; }
    }
    ls.set("sync-base", JSON.stringify(keys));
    ls.set("sync-at", String(Date.now()));
    return n;
  }
  async function sync({ create = false, pull = true } = {}) {
    const c = code();
    if (!c || state.busy) return 0;
    const ch = changes();
    if (!pull && !Object.keys(ch).length) return 0;
    state.busy = true; emit();
    try {
      const keys = Object.keys(ch).length || create ? await call("POST", c, { keys: ch }, create) : await call("GET", c);
      const n = apply(keys);
      state.error = ""; state.applied = n;
      return n;
    } catch (e) {
      state.error = e.message || "同步失败";
      throw e;
    } finally { state.busy = false; emit(); }
  }

  const api = {
    get code() { return code(); },
    get prettyCode() { const c = code(); return c ? pretty(c) : ""; },
    get busy() { return state.busy; },
    get error() { return state.error; },
    get lastAt() { return Number(ls.get("sync-at")) || 0; },
    count: () => Object.keys(current()).length,
    // 新开一个同步码，把这台设备现有的数据传上去
    async start() { const c = newCode(); ls.set("sync-code", c); ls.set("sync-base", null); try { await sync({ create: true }); } catch (e) { ls.set("sync-code", null); throw e; } return pretty(c); },
    // 在这台设备上填入已有的同步码：先确认服务器上有这一份，再合并
    async join(input) {
      const c = normCode(input);
      if (!validCode(c)) throw new Error("同步码应是 26 个字母和数字");
      await call("GET", c);
      ls.set("sync-code", c); ls.set("sync-base", null);
      return sync();
    },
    // 这台设备不再同步。本机的数据和服务器上的那一份都留着
    stop() { ls.set("sync-code", null); ls.set("sync-base", null); ls.set("sync-at", null); state.error = ""; emit(); },
    now: () => sync(),
    // 不走服务器的办法：全部导出成一段文本，到另一个浏览器里导入（按键覆盖）
    exportText: () => JSON.stringify({ app: "t.miaowuao.cn", at: Date.now(), keys: current() }),
    importText(text) {
      const j = JSON.parse(text); let n = 0;
      if (!j || j.app !== "t.miaowuao.cn" || typeof j.keys !== "object") throw new Error("这不是本站导出的数据");
      for (const [k, v] of Object.entries(j.keys)) if (wanted(k) && typeof v === "string" && ls.set(k, v)) n++;
      emit();
      return n;
    },
  };
  window.TSync = api;

  if (!code()) return;
  // 页面刚打开时拉一次。别的设备改过的东西要重新渲染才看得见，所以在打开后的头几秒内拿到改动就刷新一次（只刷一次）。
  const t0 = Date.now();
  sync().then((n) => {
    let last = 0; try { last = Number(sessionStorage.getItem("sync-reloaded")) || 0; } catch {}
    if (n && Date.now() - t0 < 5000 && Date.now() - last > 15000) { try { sessionStorage.setItem("sync-reloaded", String(Date.now())); } catch { return; } location.reload(); }
  }).catch(() => {});
  // 之后：本机有改动就推上去（每 15 秒看一眼，离开页面时再推一次）；每 5 分钟拉一次别的设备的改动
  let lastPull = Date.now();
  setInterval(() => {
    if (document.visibilityState !== "visible") return;
    const pull = Date.now() - lastPull > 300000;
    if (pull) lastPull = Date.now();
    sync({ pull }).catch(() => {});
  }, 15000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") sync({ pull: false }).catch(() => {}); });
})();
