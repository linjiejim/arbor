import {
  ArrowUpFromLine,
  Bolt,
  CircleDot,
  Combine,
  Grid3x3,
  Layers,
  Layers2,
  PackageOpen,
  PenLine,
  Rotate3d,
  Rows3,
  Scissors,
  Slash,
  Spline,
  SquareDashed,
  SquareRoundCorner,
  SquareSplitVertical,
  TriangleRight,
  type LucideIcon,
} from "lucide-react"
import type { OpId } from "@/content/ops"

const ICONS: Record<OpId, LucideIcon> = {
  plane: SquareDashed,
  sketch: PenLine,
  extrude: ArrowUpFromLine,
  cut: Scissors,
  revolve: Rotate3d,
  sweep: Spline,
  loft: Layers,
  fillet: SquareRoundCorner,
  chamfer: TriangleRight,
  shell: PackageOpen,
  draft: Slash,
  rib: Rows3,
  hole: CircleDot,
  pattern: Grid3x3,
  mirror: SquareSplitVertical,
  boolean: Combine,
  thicken: Layers2,
  thread: Bolt,
}

export function OpIcon({ op, className }: { op: OpId; className?: string }) {
  const I = ICONS[op]
  return <I className={className} aria-hidden />
}
