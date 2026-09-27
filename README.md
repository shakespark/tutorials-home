# 图解教程 · 首页

<https://t.miaowuao.cn/> 的首页，列出所有教程。单个 `index.html`，无构建步骤、无外部资源。

## 新增教程

在 `index.html` 里复制一个 `<article class="tut">` 块，改链接、文字和主题色 `--tc: var(--t1..t4)`。
如果教程在 localStorage 里记录学习进度，加上 `data-progress="前缀:总数"`，首页会显示"已学完 N / 总数"。

## 部署

推送到 `main` 后，GitHub Actions 用 rsync 同步到服务器的 `/var/www/tutorials/_home/`，
Nginx 把 `/` 指向 `_home/index.html`。各教程在 `/var/www/tutorials/<教程名>/`，由各自的仓库部署。
需要仓库 Secret `DEPLOY_SSH_KEY`（服务器上 `deploy` 用户的一把私钥，与其他仓库分开）。
