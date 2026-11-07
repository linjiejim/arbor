import { NavLink, Link } from "react-router"
import { Menu } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button, IconButton } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { AppearanceMenu } from "@/components/appearance-menu"
import { GithubMark } from "@/components/github-mark"
import { Brand } from "@/components/brand"
import { useContinue } from "@/lib/progress"
import { REPO_URL } from "@/lib/site"

const NAV = [
  { to: "/learn", label: "学习路径" },
  { to: "/teardown", label: "案例拆解" },
  { to: "/atlas", label: "工具图鉴" },
  { to: "/glossary", label: "术语表" },
  { to: "/studio", label: "AI 工作台" },
]

/**
 * Browsing pages share this 48px bar. Lessons and teardowns go full screen
 * with their own header, so the 3D viewport gets the width.
 */
export function SiteHeader() {
  const next = useContinue()
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex h-12 max-w-[1200px] items-center gap-2 px-6 max-sm:px-4">
        <Link to="/" className="mr-4 rounded-sm" aria-label="Arbor 首页">
          <Brand />
        </Link>
        <nav className="flex items-center gap-0.5 max-md:hidden">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                cn(
                  "flex h-(--control-md) items-center rounded-md px-3 text-body text-muted-foreground transition-colors duration-(--duration-fast) hover:bg-accent hover:text-foreground",
                  isActive && "bg-pressed font-medium text-foreground",
                )
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          {REPO_URL && (
            <IconButton label="GitHub 源码" asChild>
              <a href={REPO_URL} target="_blank" rel="noreferrer">
                <GithubMark className="size-4" />
              </a>
            </IconButton>
          )}
          <AppearanceMenu />
          <Button asChild variant="primary" className="max-sm:hidden">
            <Link to={next.to}>{next.label}</Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton label="导航" className="md:hidden">
                <Menu />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {NAV.map((n) => (
                <DropdownMenuItem key={n.to} asChild>
                  <Link to={n.to}>{n.label}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
