// Notes already on the model: a click on a pin opens its card, to change the words, mark it handled
// or delete it. The host (the desktop window) keeps the notes; the site has none.

export type PinNote = {
  n: number
  text: string
  /** What it is about, in a few words: 「面 · 平面 · 顶面」, 「零件「上盖」」. */
  about: string
  /** What the agent answered, if it did. */
  reply?: string
}

export type PinNotes = {
  get(n: number): PinNote | null
  /** False when it wasn't saved (the card stays open). */
  save(n: number, text: string): Promise<boolean>
  resolve(n: number): void
  remove(n: number): void
}
