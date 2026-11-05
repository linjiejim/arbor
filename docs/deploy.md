# 部署

FeatureTree 是纯静态站：`app/dist/` 加上烘焙好的 `app/public/models/`（构建时会一起拷进 `dist/models/`）。不需要服务端，也不在浏览器里跑 CAD 内核。

## 构建

```bash
cd app
npm ci --registry=https://registry.npmmirror.com
npm run check     # 类型检查、lint、设计守卫
npm run build     # 产出 app/dist
```

模型只有在改了 `models/` 之后才需要重新烘焙（`npm run bake`，需要 Python 环境，见 `docs/dev/models.md`）。烘焙结果提交在仓库里，所以只改前端时不需要 Python。

## 线上：jim-server

站点在 <https://featuretree.linjiejim.com>，和 design.linjiejim.com 用同一套静态站做法：

- push 到 `main`（改了 `app/**` 或工作流本身）时，`.github/workflows/deploy.yml` 在 GitHub Actions 里跑 `npm ci` → `npm run check` → `npm run build`。
- 构建产物 rsync 到 `/srv/featuretree/releases/<sha7>`，再原子地切换 `/srv/featuretree/current` 软链；保留最近 5 个版本。
- 最后检查首页、一个深层路由和模型索引都返回 200。
- 需要仓库 environment `jim-server` 里的 `DEV_SERVER_HOST / PORT / USERNAME / SSH_KEY`（专用 CI 密钥，不是个人密钥）。

回滚：

```bash
ssh jim-server 'ls -t /srv/featuretree/releases'
ssh jim-server 'ln -sfn /srv/featuretree/releases/<sha7> /srv/featuretree/current'
```

服务器上的 Caddy 配置（`/etc/caddy/Caddyfile`）：单页应用的路由回落到 `index.html`；带哈希的资源长期缓存；模型文件名不带哈希，重新烘焙后最多缓存 1 小时；页面本身不缓存（`header` 在 `try_files` 改写路径之前执行，所以按「不是 assets / models」匹配，而不是按 `/index.html`）。

```caddyfile
featuretree.linjiejim.com {
	import logging
	encode {
		zstd
		gzip
		match {
			header Content-Type text/*
			header Content-Type application/json*
			header Content-Type application/javascript*
			header Content-Type application/wasm*
			header Content-Type image/svg+xml*
			header Content-Type model/gltf-binary*
		}
	}
	root * /srv/featuretree/current
	@glb path *.glb
	header @glb Content-Type model/gltf-binary
	@assets path /assets/*
	header @assets Cache-Control "public, max-age=31536000, immutable"
	@models path /models/*
	header @models Cache-Control "public, max-age=3600"
	@pages not path /assets/* /models/*
	header @pages Cache-Control "no-cache"
	try_files {path} /index.html
	file_server
}
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
