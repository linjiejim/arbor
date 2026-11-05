import { Link } from "react-router"
import { Button } from "@/components/ui/button"
import { StateView } from "@/components/ui/state"

/** Any path the router doesn't know, including pages that were taken down. */
export function NotFoundPage() {
  return (
    <StateView
      kind="no-match"
      title="没有这个页面"
      description="链接可能写错了，或者这个页面已经下线。"
      action={
        <Button asChild size="sm" variant="secondary">
          <Link to="/">回到首页</Link>
        </Button>
      }
      className="min-h-[60dvh]"
    />
  )
}
