# 图解教程 · 首页

<https://t.miaowuao.cn/> 的首页，列出所有教程。无构建步骤、无外部资源。除了 `index.html`，这个仓库还放着几样全站共用的东西：

- `sync.js`：跨设备同步的前端模块，各教程站都加载它；同步面板在首页。服务端和说明在 `~/tutorials-deploy`（README 的「跨设备同步」）。
- `words.html`：跨书词本和间隔复习。汇总四本英文伴读里「记下」的词条（各站的 `<前缀>-star-<页>-<词条>`），
  复习进度存在 `home-srs-<词条的键>`，一个词一条记录。原句片段和注释不另存，复习时现取章节页。
  新增英文伴读时，把它的前缀、线上目录和书名加进 `words.html` 的 `BOOKS` 和两处正则（`words.html`、`index.html` 里各一处）。

**路径上的坑**：首页线上的地址是 `/`，文件却在 `/_home/` 里，所以首页引自己目录下的文件要写 `/_home/…`，不能用相对路径。

## 新增教程

在 `index.html` 里复制一个 `<article class="tut">` 块，改链接、文字和主题色 `--tc: var(--t1..t4)`。
如果教程在 localStorage 里记录学习进度，加上 `data-progress="前缀:总数"`，首页会显示"已学完 N / 总数"。

## 部署

推送到 `main` 后，GitHub Actions 用 rsync 同步到服务器的 `/var/www/tutorials/_home/`，
Nginx 把 `/` 指向 `_home/index.html`。各教程在 `/var/www/tutorials/<教程名>/`，由各自的仓库部署。
需要仓库 Secret `DEPLOY_SSH_KEY`（服务器上 `deploy` 用户的一把私钥，与其他仓库分开）。
