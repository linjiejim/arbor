# 部署

Arbor 是纯静态站：`app/dist/` 加上烘焙好的 `app/public/models/`（构建时会一起拷进 `dist/models/`）。不需要服务端，也不在浏览器里跑 CAD 内核。

## 构建

```bash
cd app
npm ci --registry=https://registry.npmmirror.com
npm run check     # 类型检查、lint、设计守卫
npm run build     # 产出 app/dist，最后一步生成每个页面的 HTML、sitemap.xml 和 robots.txt
```

模型只有在改了 `models/` 之后才需要重新烘焙（`npm run bake`，需要 Python 环境，见 `docs/dev/models.md`）。烘焙结果提交在仓库里，所以只改前端时不需要 Python。

## 线上：jim-server

站点在 <https://arbor.linjiejim.com>，和 design.linjiejim.com 用同一套静态站做法：

- push 到 `main`（改了 `app/**` 或工作流本身）时，`.github/workflows/deploy.yml` 在 GitHub Actions 里跑 `npm ci` → `npm run check` → `npm run build` → `npm run build:api` → 冒烟测试（`npm run e2e`），全部通过才上线。
- 静态产物 rsync 到 `/srv/arbor/releases/<sha7>`（`--link-dest` 复用上一版没变的文件），再原子地切换 `/srv/arbor/current` 软链；保留最近 5 个版本。
- 工作台 API 上传到 `/root/arbor/api/releases/<sha7>`，切换 `current` 后 `pm2 startOrReload`（进程 `arbor-api`，见 `docs/dev/studio.md`）。
- 最后检查首页、一个深层路由、模型索引和 `/api/health` 都返回 200。
- 需要仓库 environment `jim-server` 里的 `DEV_SERVER_HOST / PORT / USERNAME / SSH_KEY`（专用 CI 密钥，不是个人密钥）。

回滚：

```bash
ssh jim-server 'ls -t /srv/arbor/releases'
ssh jim-server 'ln -sfn /srv/arbor/releases/<sha7> /srv/arbor/current'
```

### 每个页面一份 HTML

网站是单页应用，微信、X 和搜索引擎的爬虫不运行 JavaScript，只看 HTML 里的 `<title>` 和 meta。所以 `npm run build` 的最后一步（`app/scripts/prerender.mjs`）把 `dist/index.html` 复制成每个页面一份，写入：

- 这一页的 `<title>` 和 description
- canonical 链接
- Open Graph / Twitter 标签：绝对地址，分享图是 `/og.png`，1200×630

| 文件 | 页面 |
| --- | --- |
| `dist/index.html` | 首页，也是未知路由的回落页 |
| `dist/<页面>/index.html` | `learn`、`teardown`、`practice`、`atlas`、`glossary`、`studio` |
| `dist/lesson/<id>/index.html` | 每节已注册的课 |
| `dist/teardown/<id>/index.html` | 每个烘焙好的模型 |
| `dist/sitemap.xml`、`dist/robots.txt` | 全部上述页面 |

- 标题和描述写在 `app/src/lib/page-meta.ts`，浏览器里的 `document.title` 也用它。
- 新加的课和模型下次构建时自动生成，不用手动维护。
- 这些副本加载的是同一份 JS，打开后照常是单页应用。

服务器要先找 `{path}/index.html`，找不到再回落到 `/index.html`，见下面的 `try_files`。

- 服务器还是旧的 `try_files {path} /index.html` 时网站照常能用，只是每个页面都拿到首页的标题。
- 改好后用 `curl -s https://arbor.linjiejim.com/lesson/revolve | grep '<title>'` 验证，应该看到这节课的标题。

### Caddy

服务器上的 Caddy 配置（`/etc/caddy/Caddyfile`）：页面先找预渲染的 `{path}/index.html`，没有再回落到 `index.html`；带哈希的资源长期缓存；模型文件名不带哈希，重新烘焙后最多缓存 1 小时；页面本身不缓存（`header` 在 `try_files` 改写路径之前执行，所以按「不是 assets / models」匹配，而不是按 `/index.html`）。

```caddyfile
arbor.linjiejim.com, featuretree.linjiejim.com {
	import logging
	# No text/event-stream here: the studio chat streams and must not be buffered.
	encode {
		zstd
		gzip
		match {
			header Content-Type text/html*
			header Content-Type text/css*
			header Content-Type text/plain*
			header Content-Type text/javascript*
			header Content-Type application/json*
			header Content-Type application/javascript*
			header Content-Type application/wasm*
			header Content-Type image/svg+xml*
			header Content-Type model/gltf-binary*
		}
	}
	handle /api/* {
		reverse_proxy 127.0.0.1:18914
	}
	handle {
		root * /srv/arbor/current
		@glb path *.glb
		header @glb Content-Type model/gltf-binary
		@assets path /assets/*
		header @assets Cache-Control "public, max-age=31536000, immutable"
		@models path /models/*
		header @models Cache-Control "public, max-age=3600"
		@pages not path /assets/* /models/*
		header @pages Cache-Control "no-cache"
		try_files {path} {path}/index.html /index.html
		file_server {
			precompressed br gzip
		}
	}
}
```

### 旧域名 featuretree.linjiejim.com

2026-11-08 项目从 FeatureTree 改名为 Arbor，站点从 `featuretree.linjiejim.com` 搬到 `arbor.linjiejim.com`。服务器目录、API 进程也一起改了名：静态站在 `/srv/arbor`，API 在 `/root/arbor/api`，进程是 `arbor-api`，密钥在 `/root/arbor/shared/.env`；分享数据已经复制过来了。

新域名的 DNS 加好以前，两个域名由同一个站点块提供（上面那样）。部署工作流的健康检查先试新域名，连不上就检查旧域名。

在 DNSPod 加好 `arbor` 的 A 记录（`43.161.221.68`）以后，运行一次：

```bash
ssh jim-server /root/arbor/switch-old-domain.sh
```

脚本先确认新域名已经解析到服务器、证书已经签好，然后把旧域名改成永久跳转（路径保留，旧链接和分享链接都能打开），校验通过才重载 Caddy，最后把 watchtower 的健康检查改到新域名。条件不满足时它会说明原因、什么都不改，可以放心重复运行。

旧目录 `/srv/featuretree`、`/root/featuretree` 留到 2026-11-15 前后，确认没问题后删掉：

```bash
ssh jim-server 'rm -rf /srv/featuretree /root/featuretree'
```

Caddy 默认不认识 `.glb`，不给 Content-Type 也就不压缩；上面显式设了 `model/gltf-binary` 并加进压缩列表。网格数据压缩率很高，例如一个 276 KB 的齿轮 GLB 用 zstd 传输只有 45 KB。

## 体积参考

| 内容 | 大小 |
| --- | --- |
| 首页入口 JS | 约 177 KB（gzip） |
| three.js 分块 | 约 178 KB（gzip），长期缓存 |
| 每节课 | 4–10 KB（gzip），按需加载 |
| 一个零件的一组参数（含全部步骤） | 40–750 KB（未压缩） |
| 全部烘焙模型 | 约 14 MB，按需加载，只下载看到的那组 |

面向国内用户时，把静态资源放在国内可访问的节点上，不要依赖 jsDelivr、unpkg 这类境外 CDN。
