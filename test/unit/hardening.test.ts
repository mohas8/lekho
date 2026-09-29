// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { editSpan } from '../../src/content/adapters/diff';
import { DeferredAdapter } from '../../src/content/adapters/deferred';
import { docsCaretRect, isDocsEventFrame, isGoogleDocsEditor } from '../../src/content/docs';
import { convertLetters } from '../../src/engine/ridmik';
import { TabManager, type BadgeState, type TabApi, type TabStatus } from '../../src/sw/tabs';
import { isToWorker, MSG } from '../../src/shared/messages';

const guard = { run: <T>(fn: () => T) => fn() };

/** Applies an edit span the way the adapters do. */
const apply = (before: string, after: string) => {
  const { keep, insert } = editSpan(before, after);
  return before.slice(0, keep) + insert;
};

describe('editSpan', () => {
  it('appends at the caret when the new text extends the old', () => {
    expect(editSpan('ক', 'কা')).toEqual({ keep: 1, insert: 'া' });
    expect(editSpan('আম', 'আমি')).toEqual({ keep: 2, insert: 'ি' });
    expect(editSpan('', 'ক')).toEqual({ keep: 0, insert: 'ক' });
  });

  it('replaces only the changed tail', () => {
    expect(editSpan('করর', 'কর্ম')).toEqual({ keep: 2, insert: '্ম' });
  });

  it('never starts a replacement inside a character cluster', () => {
    // "কি" -> "কী": the vowel sign changes; the whole cluster is replaced.
    expect(editSpan('কি', 'কী')).toEqual({ keep: 0, insert: 'কী' });
    // After a hasanta the next letter belongs to the same conjunct.
    const s = editSpan('ক্ক', 'ক্ষ');
    expect(s.keep).toBe(0);
  });

  it('reconstructs every transition while typing real words', () => {
    for (const word of ['korrmo', 'bangladesh', 'kkhoma', 'porikkha', 'gonjo', 'shadhinota', 'hoThaTH', 'caqqd', 'rZab', 'OI', 'krriti']) {
      for (let i = 1; i < word.length; i++) {
        const before = convertLetters(word.slice(0, i));
        const after = convertLetters(word.slice(0, i + 1));
        expect(apply(before, after), `${word.slice(0, i)} -> ${word.slice(0, i + 1)}`).toBe(after);
        const { keep } = editSpan(before, after);
        if (keep < before.length) {
          // A replacement starts at a cluster boundary.
          expect(/[\u0981-\u0983\u09bc\u09be-\u09cd\u09d7]/.test(before[keep] ?? '')).toBe(false);
          expect(/[\u09cd\u200d]/.test(before[keep - 1] ?? '')).toBe(false);
        }
      }
    }
  });
});

describe('Google Docs helpers', () => {
  it('recognises Docs, Slides and Sheets editors only', () => {
    expect(isGoogleDocsEditor('https://docs.google.com/document/d/abc/edit')).toBe(true);
    expect(isGoogleDocsEditor('https://docs.google.com/presentation/d/abc/edit')).toBe(true);
    expect(isGoogleDocsEditor('https://docs.google.com/spreadsheets/d/abc/edit')).toBe(true);
    expect(isGoogleDocsEditor('https://docs.google.com/forms/d/abc')).toBe(false);
    expect(isGoogleDocsEditor('https://evil.example/docs.google.com/document/')).toBe(false);
    expect(isGoogleDocsEditor('not a url')).toBe(false);
  });

  it('detects the hidden input frame', () => {
    const frame = document.createElement('iframe');
    frame.className = 'docs-texteventtarget-iframe';
    document.body.append(frame);
    expect(isDocsEventFrame(frame.contentWindow!)).toBe(true);
    expect(isDocsEventFrame(window)).toBe(false);
    frame.remove();
  });

  it('finds Docs\' visible caret', () => {
    expect(docsCaretRect(document)).toBeNull();
    const caret = document.createElement('div');
    caret.className = 'kix-cursor-caret';
    caret.getBoundingClientRect = () => new DOMRect(10, 20, 2, 18);
    document.body.append(caret);
    expect(docsCaretRect(document)).toEqual(new DOMRect(10, 20, 2, 18));
    caret.remove();
  });
});

describe('DeferredAdapter', () => {
  it('keeps the word out of the page until it is committed, then inserts it once', () => {
    const el = document.createElement('div');
    el.contentEditable = 'true';
    document.body.append(el);
    const inserted: string[] = [];
    document.execCommand = (_cmd: string, _ui?: boolean, value?: string) => {
      inserted.push(value ?? '');
      return true;
    };
    const a = new DeferredAdapter(el, guard);
    expect(a.deferred).toBe(true);
    expect(a.replace('', 'ক')).toBe(true);
    expect(a.replace('ক', 'কর')).toBe(true);
    expect(a.pendingText).toBe('কর');
    expect(inserted).toEqual([]);
    a.commit('কর্ম');
    expect(inserted).toEqual(['কর্ম']);
    expect(a.pendingText).toBe('');
    a.commit('');
    expect(inserted).toEqual(['কর্ম']);
    el.remove();
  });

  it('lets an editor that handles beforeinput take the text', () => {
    const el = document.createElement('div');
    document.body.append(el);
    let got = '';
    el.addEventListener('beforeinput', (e) => {
      got = (e as InputEvent).data ?? '';
      e.preventDefault();
    });
    let execCalls = 0;
    document.execCommand = () => {
      execCalls++;
      return true;
    };
    new DeferredAdapter(el, guard).commit('আমি');
    expect(got).toBe('আমি');
    expect(execCalls).toBe(0);
    el.remove();
  });

  it('uses the visible caret provider for the popup position', () => {
    const el = document.createElement('div');
    const a = new DeferredAdapter(el, guard, () => new DOMRect(5, 6, 1, 16));
    expect(a.anchorRect()).toEqual(new DOMRect(5, 6, 1, 16));
  });
});

describe('unsupported editor badge', () => {
  class Api implements TabApi {
    statuses = new Map<number, TabStatus>();
    badges = new Map<number, BadgeState>();
    async inject() {}
    async send() {}
    async setBadge(id: number, s: BadgeState) {
      this.badges.set(id, s);
    }
    async loadStatus(id: number) {
      return this.statuses.get(id);
    }
    async saveStatus(id: number, s: TabStatus) {
      this.statuses.set(id, s);
    }
    async clearStatus(id: number) {
      this.statuses.delete(id);
    }
  }

  it('shows "!" only while Lekho is on in that tab', async () => {
    const api = new Api();
    const tabs = new TabManager(api);
    await tabs.onUnsupported(1);
    expect(api.badges.get(1)).toBeUndefined();
    await tabs.enable(1);
    await tabs.onUnsupported(1);
    expect(api.badges.get(1)).toBe('unsupported');
    expect(isToWorker({ type: MSG.unsupported })).toBe(true);
  });
});
