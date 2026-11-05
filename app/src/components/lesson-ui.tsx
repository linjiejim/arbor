import * as React from "react"
import { CircleCheck, CircleDashed, CircleX } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Building blocks of a lesson step: task card, hints, software notes,
 * predict-then-reveal, and the end-of-lesson quiz with explanatory feedback.
 */
export function TaskCard({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("mt-5 flex gap-2.5 rounded-lg border p-3 transition-colors duration-(--duration-base)", done && "border-transparent bg-success-subtle")}>
      {done ? <CircleCheck className="mt-0.5 size-4 text-success" /> : <CircleDashed className="mt-0.5 size-4 text-faint-foreground" />}
      <div className="min-w-0">
        <div className={cn("text-small font-medium", done ? "text-success" : "text-muted-foreground")}>{done ? "完成" : "试一试"}</div>
        <div className="text-body">{children}</div>
      </div>
    </div>
  )
}

export function Hint({ children, tone }: { children: React.ReactNode; tone?: "warning" }) {
  return <p className={cn("mt-3 rounded-md px-3 py-2 text-body", tone === "warning" ? "bg-warning-subtle text-warning" : "bg-sunken text-foreground")}>{children}</p>
}

export function Note({ children, title = "软件差异" }: { children: React.ReactNode; title?: string }) {
  return (
    <div className="mt-5 border-l-2 border-border pl-3 text-small text-muted-foreground">
      <span className="font-medium text-foreground">{title} · </span>
      {children}
    </div>
  )
}

/** Inline value readout used in step bodies ("自由度 2", "深度 20 mm"). */
export function Readout({ label, value, unit, tone }: { label: string; value: React.ReactNode; unit?: string; tone?: "primary" | "success" | "warning" }) {
  return (
    <span className="mr-4 inline-flex items-baseline gap-1.5 text-small">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-mono text-body font-medium tabular",
          tone === "primary" && "text-primary",
          tone === "success" && "text-success",
          tone === "warning" && "text-warning",
        )}
      >
        {value}
      </span>
      {unit && <span className="text-faint-foreground">{unit}</span>}
    </span>
  )
}

export function Choices({
  options,
  answer,
  picked,
  onPick,
  letters = true,
}: {
  options: string[]
  answer: number
  picked: number | null
  onPick: (i: number) => void
  letters?: boolean
}) {
  return (
    <div className="mt-2 flex flex-col gap-1.5">
      {options.map((o, i) => {
        const revealed = picked !== null
        const right = revealed && i === answer
        const wrong = revealed && picked === i && i !== answer
        return (
          <button
            key={o}
            type="button"
            disabled={revealed}
            onClick={() => onPick(i)}
            className={cn(
              "flex items-start gap-2 rounded-md border px-3 py-2 text-left text-body transition-colors duration-(--duration-fast)",
              !revealed && "hover:bg-accent",
              right && "border-transparent bg-success-subtle",
              wrong && "border-transparent bg-destructive-subtle",
              revealed && !right && !wrong && "text-muted-foreground",
            )}
          >
            {letters && <span className="w-4 shrink-0 font-medium text-faint-foreground">{"ABCDE"[i]}</span>}
            <span className="flex-1">{o}</span>
            {right && <CircleCheck className="mt-0.5 size-4 text-success" />}
            {wrong && <CircleX className="mt-0.5 size-4 text-destructive" />}
          </button>
        )
      })}
    </div>
  )
}

/** Guess first; picking an answer reveals it in the viewport via onReveal. */
export function Predict({
  question,
  options,
  answer,
  explain,
  onReveal,
}: {
  question: string
  options: string[]
  answer: number
  explain: string
  onReveal?: (picked: number) => void
}) {
  const [picked, setPicked] = React.useState<number | null>(null)
  return (
    <div className="mt-5 rounded-lg border p-3">
      <div className="text-small font-medium text-muted-foreground">先猜一猜</div>
      <div className="mt-1 text-body font-medium">{question}</div>
      <Choices
        options={options}
        answer={answer}
        picked={picked}
        onPick={(i) => {
          setPicked(i)
          onReveal?.(i)
        }}
      />
      {picked !== null && (
        <p className="mt-2 text-body">
          <span className="font-medium">{picked === answer ? "猜对了。" : "看看视图里发生了什么。"}</span>
          {explain}
        </p>
      )}
    </div>
  )
}

export type QuizItem = { q: string; options: string[]; answer: number; explain: string }

export function Quiz({ items, onDone }: { items: QuizItem[]; onDone: (score: number) => void }) {
  const [answers, setAnswers] = React.useState<(number | null)[]>(items.map(() => null))
  const done = answers.every((a) => a !== null)
  const score = answers.filter((a, i) => a === items[i].answer).length
  const reported = React.useRef(false)
  React.useEffect(() => {
    if (done && !reported.current) {
      reported.current = true
      onDone(score)
    }
  }, [done, score, onDone])
  return (
    <div className="mt-4 space-y-4" data-testid="quiz">
      {items.map((item, qi) => (
        <div key={item.q} className="rounded-lg border p-3">
          <div className="text-body font-medium">
            {qi + 1}. {item.q}
          </div>
          <Choices
            letters={false}
            options={item.options}
            answer={item.answer}
            picked={answers[qi]}
            onPick={(i) => setAnswers((a) => a.map((x, j) => (j === qi ? i : x)))}
          />
          {answers[qi] !== null && <p className="mt-2 text-small text-muted-foreground">{item.explain}</p>}
        </div>
      ))}
      {done && (
        <p className="text-small text-muted-foreground">
          答对 <span className="font-medium tabular text-foreground">{score}</span> / {items.length}。
          {score < items.length ? "答错的题会在复习里再出现。" : ""}
        </p>
      )}
    </div>
  )
}

export function StepBar({ titles, current, onJump, className }: { titles: string[]; current: number; onJump: (i: number) => void; className?: string }) {
  return (
    <div className={cn("flex items-center gap-1", className)} role="tablist" aria-label="课程步骤">
      {titles.map((t, i) => (
        <button
          key={i}
          type="button"
          role="tab"
          aria-selected={i === current}
          aria-label={`第 ${i + 1} 步：${t}`}
          title={t}
          onClick={() => onJump(i)}
          className="group flex h-6 items-center px-0.5"
        >
          <span
            className={cn(
              "block h-1 w-6 rounded-full transition-colors duration-(--duration-fast)",
              i < current ? "bg-foreground" : i === current ? "bg-primary" : "bg-muted group-hover:bg-input",
            )}
          />
        </button>
      ))}
    </div>
  )
}

/** Floating chip in the viewport (sketch mode, DOF, current value). */
export function SceneChip({ children, tone, className }: { children: React.ReactNode; tone?: "primary"; className?: string }) {
  return (
    <div
      className={cn(
        "flex h-7 items-center gap-1.5 rounded-md border bg-popover px-2 text-small tabular shadow-popover [&_svg]:size-3.5",
        tone === "primary" && "text-primary",
        className,
      )}
    >
      {children}
    </div>
  )
}
