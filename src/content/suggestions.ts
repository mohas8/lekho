/**
 * Connects the typing controller, the suggestion service and the popup.
 *
 * The popup appears as soon as a word is started, first with only the instant
 * Ridmik output (and the English word), then with dictionary words when the
 * service worker answers. Candidate #1 is always the Ridmik output and is
 * highlighted by default, so Space commits exactly what the Ridmik rules give
 * unless the user picks something else, or picked something else for the
 * same word before ("Remember my choices").
 */
import type { Composition } from './composer';
import type { EditAdapter } from './adapters/types';
import type { SuggestClient } from './suggestClient';
import { createState, decideKey, mergeState, move, select, selectedWord, type CandidateState } from './popup/candidates';
import type { SuggestionPopup } from './popup/popup';

/** The parts of Controller this module uses. */
export interface ControllerLike {
  readonly composition: Composition | null;
  readonly currentAdapter: EditAdapter | null;
  substitute(text: string): boolean;
  finish(): void;
}

export class SuggestionUi {
  private state: CandidateState | null = null;
  private enabled = true;
  private frame = 0;
  private listening = false;
  private readonly reposition = () => this.render();

  constructor(
    private readonly controller: ControllerLike,
    private readonly client: SuggestClient,
    private readonly popup: SuggestionPopup,
    private readonly win: Window,
  ) {}

  get current(): CandidateState | null {
    return this.state;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on && this.controller.currentAdapter?.deferred !== true) this.hide();
  }

  /** Controller hook: the current word changed (or ended). */
  onCompositionChange(comp: Composition | null): void {
    // In deferred mode (Google Docs) the popup is the only place the word is
    // visible, so it is shown even with suggestions off, and for digits too.
    const deferred = this.controller.currentAdapter?.deferred === true;
    if (!comp || (!deferred && (!this.enabled || comp.kind !== 'letters'))) {
      this.hide();
      return;
    }
    if (this.state?.roman === comp.roman) {
      this.render(); // text swapped by a chosen candidate: same word, new width
      return;
    }

    // Instant list: the Ridmik output and the English word, until the dictionary answers.
    this.state = createState(comp.roman, [comp.rendered], { complete: false });
    this.render();
    if (!this.enabled || comp.kind !== 'letters') return;
    const roman = comp.roman;
    void this.client.request(roman).then((reply) => {
      const now = this.controller.composition;
      if (!reply || !this.state || this.state.roman !== roman || now?.roman !== roman) return;
      const words = reply.words.length > 0 ? reply.words : [now.rendered];
      const next = createState(roman, words);
      const preselect = reply.preferred === undefined ? -1 : next.words.indexOf(reply.preferred);
      this.state = mergeState(this.state, preselect > 0 ? createState(roman, words, { preselect }) : next);
      this.syncPageText();
      this.render();
    });
  }

  /** Controller hook: keys while a word is being typed. */
  interceptKey(e: KeyboardEvent): boolean {
    const comp = this.controller.composition;
    const state = this.state;
    // The list counts as open from the moment it is scheduled, so keys pressed
    // before the next frame behave the same as after it.
    const open = this.popup.visible || this.frame !== 0;
    if (!state || !comp || comp.roman !== state.roman || !open) return false;

    const decision = decideKey(e, state, comp.kind);
    switch (decision.type) {
      case 'move':
        this.state = move(state, decision.delta);
        this.syncPageText();
        this.popup.update(this.state);
        return true;
      case 'close':
        this.controller.finish();
        this.hide();
        return true;
      case 'accept':
        this.accept(state);
        if (!decision.consume) return false; // the key then ends the word normally
        this.controller.finish();
        return true;
      case 'pass':
        return false;
    }
  }

  /** Popup hook: a candidate was clicked. */
  choose(index: number): void {
    if (!this.state) return;
    this.state = select(this.state, index);
    this.accept(this.state);
    this.controller.finish();
  }

  isOwnEvent(e: Event): boolean {
    return e.composedPath().includes(this.popup.host);
  }

  hide(): void {
    this.client.cancel();
    this.state = null;
    if (this.frame) this.win.cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.popup.hide();
    this.stopListening();
  }

  private accept(state: CandidateState): void {
    const word = selectedWord(state);
    this.controller.substitute(word);
    // Only choices made in the full list are remembered, and only changes of
    // the default (picking the default again un-learns a remembered choice).
    if (state.complete && state.selected !== state.initial) this.client.learn(state.roman, word);
  }

  /**
   * The page always shows the highlighted candidate, so what you see is what
   * you get even if the word ends by a click or focus change.
   */
  private syncPageText(): void {
    const state = this.state;
    const comp = this.controller.composition;
    if (!state || !comp || comp.roman !== state.roman) return;
    const word = selectedWord(state);
    if (word !== comp.rendered && !this.controller.substitute(word)) this.hide();
  }

  /** Draws on the next frame, so typing never waits for layout. */
  private render(): void {
    if (this.frame) return;
    this.frame = this.win.requestAnimationFrame(() => {
      this.frame = 0;
      const state = this.state;
      const comp = this.controller.composition;
      if (!state || !comp || comp.roman !== state.roman) return;
      this.popup.show(state, this.controller.currentAdapter?.anchorRect(comp.rendered.length) ?? null);
      this.startListening();
    });
  }

  private startListening(): void {
    if (this.listening) return;
    this.listening = true;
    // Capture: scrolling any container (not only the page) moves the word.
    this.win.addEventListener('scroll', this.reposition, { capture: true, passive: true });
    this.win.addEventListener('resize', this.reposition, { passive: true });
    this.win.visualViewport?.addEventListener('resize', this.reposition, { passive: true });
  }

  private stopListening(): void {
    if (!this.listening) return;
    this.listening = false;
    this.win.removeEventListener('scroll', this.reposition, { capture: true });
    this.win.removeEventListener('resize', this.reposition);
    this.win.visualViewport?.removeEventListener('resize', this.reposition);
  }
}
