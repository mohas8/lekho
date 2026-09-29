/**
 * Content-script controller: listens to keys in the page and drives the
 * composer and the edit adapters.
 */
import { Composer, type Composition, type Step } from './composer';
import { classifyKey } from './keys';
import { deepTarget, editableKind, type EditableKind } from './fields';
import type { ApplyGuard, EditAdapter } from './adapters/types';
import { TextFieldAdapter, type TextField } from './adapters/textField';
import { ContentEditableAdapter } from './adapters/contentEditable';
import type { TransliterateOptions } from '../engine/transliterate';

export interface ControllerHooks {
  /** Called after every change of the current word (null when no word is being typed). */
  onCompositionChange?(composition: Composition | null, adapter: EditAdapter | null): void;
  /** Called when a word is finished. */
  onCommit?(composition: Composition): void;
  /**
   * Returns false once the extension was reloaded or removed; the controller
   * then detaches itself so an orphaned script stops converting keys.
   */
  isAlive?(): boolean;
  /**
   * Called for each key while a word is being typed, before the normal rules.
   * Return true if the key was fully handled (it is then consumed).
   */
  interceptKey?(e: KeyboardEvent): boolean;
  /** True for events on Lekho's own UI (the suggestion popup), which must not end the word. */
  isOwnEvent?(e: Event): boolean;
}

export type AdapterFactory = (el: Element, kind: EditableKind, guard: ApplyGuard) => EditAdapter | null;

/**
 * Test builds only: for each key handled while enabled, the total time in the
 * handler and the part of it spent inside the page's own editing (execCommand
 * and the editor's reaction), in ms.
 */
export const keyTimings: Array<{ total: number; edit: number }> = [];
let editTime = 0;

export const defaultAdapterFactory: AdapterFactory = (el, kind, guard) =>
  kind === 'text' ? new TextFieldAdapter(el as TextField, guard) : new ContentEditableAdapter(el as HTMLElement, guard);

export class Controller {
  private enabled = false;
  private attached = false;
  private readonly composer: Composer;
  private adapter: EditAdapter | null = null;
  private applying = false;
  private readonly guard: ApplyGuard = {
    run: <T>(fn: () => T): T => {
      this.applying = true;
      try {
        return fn();
      } finally {
        this.applying = false;
      }
    },
  };

  constructor(
    private readonly win: Window,
    options: TransliterateOptions,
    private readonly hooks: ControllerHooks = {},
    private readonly adapterFactory: AdapterFactory = defaultAdapterFactory,
  ) {
    this.composer = new Composer(options);
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  get composition(): Composition | null {
    return this.composer.composition;
  }

  get currentAdapter(): EditAdapter | null {
    return this.adapter;
  }

  attach(): void {
    if (this.attached) return;
    this.attached = true;
    this.win.addEventListener('keydown', this.onKeyDown, true);
    this.win.addEventListener('mousedown', this.onPointerDown, true);
    this.win.addEventListener('focusout', this.onFocusOut, true);
    this.win.addEventListener('beforeinput', this.onBeforeInput, true);
    this.win.addEventListener('compositionstart', this.onFocusOut, true);
  }

  detach(): void {
    if (!this.attached) return;
    this.finish();
    this.attached = false;
    this.win.removeEventListener('keydown', this.onKeyDown, true);
    this.win.removeEventListener('mousedown', this.onPointerDown, true);
    this.win.removeEventListener('focusout', this.onFocusOut, true);
    this.win.removeEventListener('beforeinput', this.onBeforeInput, true);
    this.win.removeEventListener('compositionstart', this.onFocusOut, true);
  }

  setEnabled(on: boolean): void {
    if (!on) this.finish();
    this.enabled = on;
  }

  setOptions(options: TransliterateOptions): void {
    this.finish();
    this.composer.setOptions(options);
  }

  /** Finishes the current word (its text stays in the page). */
  finish(): void {
    const steps = this.composer.commit();
    if (steps.length === 0) return;
    for (const step of steps) if (step.type === 'commit') this.committed(step.composition, this.adapter);
    this.notify();
  }

  private committed(composition: Composition, adapter: EditAdapter | null): void {
    adapter?.commit?.(composition.rendered);
    this.hooks.onCommit?.(composition);
  }

  /**
   * Replaces the current word's text in the page, e.g. with a chosen
   * suggestion. Returns false if the page text no longer matches.
   */
  substitute(text: string): boolean {
    const adapter = this.adapter;
    const step = this.composer.substitute(text);
    if (!step) return true;
    if (adapter && this.applySteps([step], adapter)) {
      this.notify();
      return true;
    }
    this.composer.reset();
    this.notify();
    return false;
  }

  private adapterFor(el: Element, kind: EditableKind): EditAdapter | null {
    if (this.adapter?.element === el && this.adapter.element.isConnected) return this.adapter;
    this.finish();
    this.adapter = this.adapterFactory(el, kind, this.guard);
    return this.adapter;
  }

  private applySteps(steps: readonly Step[], adapter: EditAdapter): boolean {
    for (const step of steps) {
      if (step.type === 'commit') this.committed(step.composition, adapter);
      else if (!this.edit(adapter, step.before, step.after)) return false;
    }
    return true;
  }

  private edit(adapter: EditAdapter, before: string, after: string): boolean {
    if (!__TEST__) return adapter.replace(before, after);
    const t0 = performance.now();
    try {
      return adapter.replace(before, after);
    } finally {
      editTime += performance.now() - t0;
    }
  }

  private notify(): void {
    this.hooks.onCompositionChange?.(this.composer.composition, this.adapter);
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (!__TEST__) {
      this.handleKeyDown(e);
      return;
    }
    const t0 = performance.now();
    editTime = 0;
    this.handleKeyDown(e);
    if (this.enabled) keyTimings.push({ total: performance.now() - t0, edit: editTime });
  };

  private handleKeyDown(e: KeyboardEvent): void {
    // Ignore events synthesized by page scripts: they cannot insert text anyway.
    if (!this.enabled || !e.isTrusted) return;
    if (this.hooks.isAlive && !this.hooks.isAlive()) {
      this.enabled = false;
      this.detach();
      return;
    }

    const target = deepTarget(e);
    const kind = editableKind(target);
    const adapter = target && kind ? this.adapterFor(target, kind) : null;
    if (!adapter) {
      this.finish();
      return;
    }

    const action = classifyKey(e);
    if (action.type === 'ignore') return;
    if (this.composer.active && !e.defaultPrevented && this.hooks.interceptKey?.(e)) {
      consume(e);
      return;
    }
    if (action.type === 'boundary' || e.defaultPrevented) {
      this.finish();
      return;
    }

    const result = action.type === 'backspace' ? this.composer.backspace() : this.composer.type(action.ch);
    if (!result.handled) {
      this.applySteps(result.steps, adapter);
      this.notify();
      return;
    }
    if (this.applySteps(result.steps, adapter)) {
      consume(e);
      this.notify();
      return;
    }

    // The page text changed underneath the word: forget it and start over
    // from this key. If even that fails, let the key through untouched.
    this.composer.reset();
    if (action.type === 'char') {
      const retry = this.composer.type(action.ch);
      if (retry.handled && this.applySteps(retry.steps, adapter)) {
        consume(e);
        this.notify();
        return;
      }
      this.composer.reset();
    }
    this.notify();
  }

  private readonly onPointerDown = (e: Event): void => {
    if (this.hooks.isOwnEvent?.(e)) return;
    // The caret is about to move.
    this.finish();
  };

  private readonly onFocusOut = (e: Event): void => {
    if (this.hooks.isOwnEvent?.(e)) return;
    this.finish();
  };

  private readonly onBeforeInput = (e: Event): void => {
    // Paste, drop, spell-check replacement, OS IME, ...: the text is changing by
    // other means, so the current word ends where it is. (Our own edits and
    // events inside other editables, e.g. while focus moves, don't count.)
    if (this.applying || !this.adapter) return;
    const target = deepTarget(e);
    if (target && target !== this.adapter.element && !this.adapter.element.contains(target)) return;
    this.finish();
  };
}

function consume(e: KeyboardEvent): void {
  e.preventDefault();
  e.stopImmediatePropagation();
}
