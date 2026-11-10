/**
 * Post-build step (runs after `vite build`, see package.json).
 *
 * The site is a single-page app, so every route used to share one
 * index.html with one <title>. Crawlers and link previews (WeChat, X,
 * search engines) never run JavaScript, so they saw the same title for
 * every lesson. This writes a copy of dist/index.html per page, with that
 * page's <title>, description, canonical URL and Open Graph / Twitter tags:
 *
 *   dist/index.html                      home (also the fallback for unknown routes)
 *   dist/learn/index.html                top-level pages
 *   dist/lesson/<id>/index.html          every registered lesson
 *   dist/teardown/<id>/index.html        every baked model
 *
 * plus dist/sitemap.xml and dist/robots.txt. The copies load the same
 * bundle, so the app takes over as usual. The server must try
 * `{path}/index.html` before falling back to /index.html (docs/deploy.md).
 *
 * Titles and descriptions come from src/lib/page-meta.ts, which the app
 * also uses for document.title; Vite's module runner loads it here.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { runnerImport } from "vite"

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const dist = path.join(app, "dist")

const load = async (file) => {
  const { module } = await runnerImport(path.join(app, file), {
    root: app,
    logLevel: "error",
    resolve: { alias: { "@": path.join(app, "src") } },
  })
  return module
}

const meta = await load("src/lib/page-meta.ts")
const { SITE_URL } = await load("src/lib/site.ts")
const models = JSON.parse(await readFile(path.join(dist, "models", "index.json"), "utf8"))

const OG_IMAGE = { path: "/og.png", width: 1200, height: 630, alt: "Turnery：看懂每一个特征是怎么长出来的。图中马克杯的把手由扫掠生成" }

/** @type {{ path: string, title: string | null, description: string }[]} */
const pages = [
  ...Object.entries(meta.STATIC_PAGES).map(([p, m]) => ({ path: p, ...m })),
  ...meta.lessonPaths().map((p) => ({ path: p, ...meta.lessonPageMeta(p.slice("/lesson/".length)) })),
  ...Object.values(models).map((m) => ({ path: `/teardown/${m.id}`, ...meta.teardownPageMeta(m) })),
  ...meta.cardPaths().map((p) => ({ path: p, ...meta.cardPageMeta(p.slice("/card/".length)) })),
]
for (const p of pages) {
  if (!/^\/([\w.-]+(\/[\w.-]+)*)?$/.test(p.path) || p.path.includes("..")) throw new Error(`prerender: unsafe path ${p.path}`)
  if (!p.description) throw new Error(`prerender: no description for ${p.path}`)
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
const absolute = (p) => `${SITE_URL}${p}`
const BEGIN = "<!-- page-meta -->"
const END = "<!-- /page-meta -->"

// dist/index.html is rewritten below; drop a block left by an earlier run so this stays idempotent.
const template = (await readFile(path.join(dist, "index.html"), "utf8")).replace(new RegExp(`\\s*${BEGIN}[\\s\\S]*?${END}`), "")
if (!/<title>[\s\S]*?<\/title>/.test(template) || !template.includes("</head>")) throw new Error("prerender: dist/index.html has no <title> or </head>")

function render(page) {
  const title = meta.documentTitle(page.title)
  const url = absolute(page.path)
  const image = absolute(OG_IMAGE.path)
  const tags = [
    `<meta name="description" content="${esc(page.description)}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${esc(meta.SITE_NAME)}" />`,
    `<meta property="og:locale" content="zh_CN" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(page.description)}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta property="og:image:width" content="${OG_IMAGE.width}" />`,
    `<meta property="og:image:height" content="${OG_IMAGE.height}" />`,
    `<meta property="og:image:alt" content="${esc(OG_IMAGE.alt)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(page.description)}" />`,
    `<meta name="twitter:image" content="${image}" />`,
  ]
  return template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
    .replace("</head>", `  ${BEGIN}\n    ${tags.join("\n    ")}\n    ${END}\n  </head>`)
}

for (const page of pages) {
  const dir = page.path === "/" ? dist : path.join(dist, ...page.path.split("/").filter(Boolean))
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, "index.html"), render(page))
}

const sitemap = [
  `<?xml version="1.0" encoding="UTF-8"?>`,
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
  ...pages.map((p) => `  <url><loc>${esc(absolute(p.path))}</loc></url>`),
  `</urlset>`,
  ``,
].join("\n")
await writeFile(path.join(dist, "sitemap.xml"), sitemap)
await writeFile(path.join(dist, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${absolute("/sitemap.xml")}\n`)

console.log(`prerender: ${pages.length} pages, sitemap.xml, robots.txt`)
