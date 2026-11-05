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

## Caddy

单页应用的路由要回落到 `index.html`；模型文件和带哈希的静态资源可以长期缓存。

```caddyfile
featuretree.example.com {
	root * /srv/featuretree/dist
	encode zstd gzip
	@hashed path /assets/*
	header @hashed Cache-Control "public, max-age=31536000, immutable"
	@models path /models/*
	header @models Cache-Control "public, max-age=86400"
	try_files {path} /index.html
	file_server
}
```

GLB 是二进制几何，gzip 压缩后大约是原来的 40%–60%。

## 体积参考

| 内容 | 大小 |
| --- | --- |
| 首页入口 JS | 约 177 KB（gzip） |
| three.js 分块 | 约 178 KB（gzip），长期缓存 |
| 每节课 | 4–10 KB（gzip），按需加载 |
| 一个零件的一组参数（含全部步骤） | 40–750 KB（未压缩） |
| 全部烘焙模型 | 约 14 MB，按需加载，只下载看到的那组 |

面向国内用户时，把静态资源放在国内可访问的节点上，不要依赖 jsDelivr、unpkg 这类境外 CDN。
