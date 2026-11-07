import * as React from "react"

/**
 * Words the shared workbench components use for whoever builds the model: the
 * site's tutor (助教) or, in the desktop window, the person's own agent.
 */
export type HostWords = {
  /** 「助教」/「agent」 */
  helper: string
  /** The feature card's button that hands a step over. */
  askStep: string
  /** The same, on a step that failed. */
  fixStep: string
  /** When a selection can't be described: let the helper pick. */
  pickFor: string
  /** The model is being changed right now. */
  busy: string
  /** A failed requirement check: hand it over. */
  fixCheck: string
  /** The parameter list is empty. */
  noParams: string
}

export const WEB_WORDS: HostWords = {
  helper: "助教",
  askStep: "让助教改这一步…",
  fixStep: "让助教修这一步",
  pickFor: "让助教来选",
  busy: "助教正在改模型，这一轮结束后再改。",
  fixCheck: "让助教修正",
  noParams: "助教会把关键尺寸定成参数，之后在这里直接改。",
}

export const DESKTOP_WORDS: HostWords = {
  helper: "agent",
  askStep: "给 agent 留备注…",
  fixStep: "给 agent 留备注",
  pickFor: "让 agent 来选",
  busy: "agent 正在改模型，这一步结束后再改。",
  fixCheck: "给 agent 留备注",
  noParams: "agent 会把关键尺寸定成参数，之后在这里直接改。",
}

export const WordsContext = React.createContext<HostWords>(WEB_WORDS)
export const useWords = () => React.useContext(WordsContext)
