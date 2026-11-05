import { LESSONS } from "@/content/lessons"
import type { ModelIndexEntry } from "@/three/baked"

/**
 * Title and description of every page. The browser uses the titles
 * (document-title.ts); the post-build script (scripts/prerender.mjs) writes
 * both into a static HTML copy per route, for crawlers and link previews
 * that never run JavaScript. Keep this module free of heavy imports: it is
 * loaded by Node at build time.
 */
export type PageMeta = {
  /** Page name; null on the home page, which shows the site name alone. */
  title: string | null
  /** One or two plain sentences, about 80 characters at most (link previews cut the rest). */
  description: string
}

export const SITE_NAME = "FeatureTree"
export const SITE_TAGLINE = "工业建模互动课"

/** Pages with a fixed path, in sitemap order. */
export const STATIC_PAGES: Record<string, PageMeta> = {
  "/": {
    title: null,
    description: "中文、讲概念、不绑定软件的 3D 工业建模互动课。每个概念配一个能亲手操作的 3D 场景，真实零件按特征树一步步重建。",
  },
  "/learn": {
    title: "学习路径",
    description: "一条公共地基加五条主轨：坐标与视图、参数化零件、装配、工程图、面向制造的设计、曲面。按人群给入口，学完有小测和到期复习。",
  },
  "/teardown": {
    title: "案例拆解",
    description: "真实零件按特征树一步步重建：几何由 build123d 和 OpenCascade 内核算出，每个面都标明是哪一步生成或修改的。",
  },
  "/practice": {
    title: "练习",
    description: "把打乱的特征树排回能重建、设计意图最好的顺序；先猜改一个参数会不会失败，再看内核算出的结果。",
  },
  "/atlas": {
    title: "工具图鉴",
    description: "每个建模命令一张卡：它做什么、要什么输入、常见的坑，以及在 SOLIDWORKS、Fusion、Onshape 等软件里分别叫什么。",
  },
  "/glossary": {
    title: "术语表",
    description: "同一个建模命令在 8 个软件里的叫法对照，以及基准、设计意图、拓扑命名、自由度等概念卡。",
  },
}

/** A registered lesson's page, or undefined for an unknown id. */
export function lessonPageMeta(id: string): PageMeta | undefined {
  const l = LESSONS.find((x) => x.id === id)
  return l && { title: l.title, description: `互动课，约 ${l.minutes} 分钟。${l.gist}` }
}

export function teardownPageMeta(m: Pick<ModelIndexEntry, "kind" | "title" | "subtitle" | "teaches">): PageMeta {
  const what = m.kind === "assembly" ? "装配拆解" : "按特征树重建"
  return {
    title: `${m.title} · 案例拆解`,
    description: `${m.title}${what}：${m.subtitle}。${m.teaches.length ? `要点：${m.teaches.slice(0, 3).join("、")}。` : ""}`,
  }
}

/** What goes in <title>. */
export const documentTitle = (title: string | null | undefined) => (title ? `${title} · ${SITE_NAME}` : `${SITE_NAME} · ${SITE_TAGLINE}`)

/** Every lesson path that gets its own HTML copy. */
export const lessonPaths = () => LESSONS.map((l) => `/lesson/${l.id}`)
