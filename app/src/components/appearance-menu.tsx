import { Monitor, Moon, Sun } from "lucide-react"
import { IconButton } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useAppearance, type Appearance } from "@/lib/appearance"

export function AppearanceMenu() {
  const { preference, resolved, setAppearance } = useAppearance()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton label="外观" className="text-muted-foreground">
          {resolved === "dark" ? <Moon /> : <Sun />}
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuRadioGroup value={preference} onValueChange={(v) => setAppearance(v as Appearance)}>
          <DropdownMenuRadioItem value="system">
            <Monitor />
            跟随系统
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="light">
            <Sun />
            浅色
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon />
            深色
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
