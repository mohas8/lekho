/** Writes composed text into a page element. One adapter per focused element. */
export interface EditAdapter {
  readonly element: Element;
  /**
   * Replaces `before`, which must be exactly the text immediately before a
   * collapsed caret at the position left by the previous replace, with `after`.
   * `before === ""` starts a new word at the caret (replacing any selection).
   *
   * Returns false and changes nothing if the check fails, e.g. because the
   * page or the user changed the text or moved the caret.
   */
  replace(before: string, after: string): boolean;
  /**
   * Screen rectangle of the current word (or the caret), for the suggestion
   * popup, in the coordinates of the document the popup is shown in.
   */
  anchorRect(length: number): DOMRect | null;
  /**
   * true: the word is not written into the page while it is typed (only shown
   * in the popup) and is inserted once by commit(). Used for editors whose
   * text can't be replaced in place, such as Google Docs.
   */
  readonly deferred?: boolean;
  /** Called when a word is finished, with its final text. */
  commit?(text: string): void;
}

/** Runs `fn` with a flag set so the controller can ignore the input events we cause ourselves. */
export interface ApplyGuard {
  run<T>(fn: () => T): T;
}
