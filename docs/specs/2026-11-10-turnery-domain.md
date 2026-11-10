# 域名和服务器改名：arbor.linjiejim.com → turnery.linjiejim.com

- 状态：进行中（解析已生效；代码和脚本已备好，服务器两步由 Jim 运行）
- 日期：2026-11-10
- 范围：网站域名、服务器上的目录和进程名、站内写死的地址、旧域名的交接页。做法照 `2026-11-08-arbor-rename-surfaces.md` 里上一次的迁移。
- 不在范围：桌面版（已经改完，见 `2026-11-10-turnery-rename.md`）。
- 前提：Jim 给 `turnery.linjiejim.com` 加解析，指向和 `arbor.linjiejim.com` 同一台机器。

## 为什么等解析

`SITE_URL` 一改，每个页面的 canonical、分享图和 sitemap 都指向新域名。解析没好之前改，搜索引擎和分享出去的链接都会指向打不开的地址。所以代码和服务器一起切，放在解析生效之后。

## 要改的

| 位置 | 现在 | 改成 |
| --- | --- | --- |
| `app/src/lib/site.ts` 的 `SITE_URL`、`app/scripts/make-og.py` 的 `HOST`、`LICENSE-content`、issue 模板里的示例地址、README | `arbor.linjiejim.com` | `turnery.linjiejim.com` |
| `app/server/models.ts` 的 `HTTP-Referer` | 旧域名 | 新域名 |
| 服务器静态站 | `/srv/arbor` | `/srv/turnery` |
| 服务器 API、密钥、数据 | `/root/arbor/api`、`/root/arbor/shared/.env`、`/root/arbor/api/data` | `/root/turnery/...`；分享数据复制过去 |
| pm2 进程 | `arbor-api` | `turnery-api`（端口不变，18914） |
| `.github/workflows/deploy.yml`、`app/server/ecosystem.config.cjs`、`docs/deploy.md`、`docs/dev/studio.md` | 旧路径 | 新路径 |
| Caddy | 只有旧域名 | 新域名指向 `/srv/turnery`；旧域名改成只发交接页 |
| 学习进度的键 | `arbor:progress`、`arbor:practice` | 不改 |

## 进度怎么带过去

学习进度存在浏览器里，按域名隔离。上一次的做法可以原样再用一遍：

- 旧域名的每个地址都回同一个交接页（`app/public/moved.html`）：它读出这个域名下的进度、工作台模型和设置，放在地址的 `#` 后面带去新域名（不经过服务器）。
- 新域名的页面启动时（`app/src/lib/moved.ts`）把带来的数据合并进本地：进度取并集，分享链接按 id 合并。
- 现在这套代码是为 featuretree → arbor 写的。要把 `moved.html` 里的新域名换掉，并让 `featuretree.linjiejim.com` 也直接交接到新域名，不绕 arbor。键名不变，所以合并逻辑不用动。

## 顺序

1. 解析生效，`curl -I https://turnery.linjiejim.com` 能通（Caddy 自动签证书）。
2. 服务器上建新目录，复制 `shared/.env` 和分享数据；pm2 起 `turnery-api`，旧进程先留着。
3. 合并改地址的 PR，部署到新路径；Caddy 加新域名。
4. 线上检查：首页、深层路由、`/api/health`、分享链接、OG 图。
5. 旧域名切到交接页；在旧域名下造一份进度，确认带过去并合并。
6. 旧目录和旧进程留一周再删。

## 验收

- [ ] 新域名首页、一节课、一个拆解、工作台、一条旧的分享链接都能打开。
- [ ] 旧域名任何路径都跳到新域名的同一路径，进度还在。
- [ ] e2e 里「旧域名交接页」那一项改成新域名后通过。
- [ ] 一周后旧目录、旧进程删除。

## 落地记录

2026-11-10：

- 解析已生效（`turnery.linjiejim.com` → 43.161.221.68）。
- 代码：站内地址、分享图、部署路径、pm2 进程名、交接页都改到新域名；两个旧域名共用一个交接块，featuretree 不再绕 arbor。
- 和原计划不同的地方：
  - 服务器上的步骤没有由 agent 直接执行，写成了 `app/scripts/move-to-turnery.sh`（`prepare`、`switch` 两步），由 Jim 运行。
  - 新旧 API 进程用同一个端口，不能并存：改路径后的第一次部署先停 `arbor-api`、复制分享数据，再起 `turnery-api`，中间接口会断几秒。
- 验证：Caddyfile 的两处改写在服务器文件的本地副本上试过（加一个站点块；删两个旧块、加一个交接块）；没有在服务器上跑过。线上验收项等两步跑完再勾。
