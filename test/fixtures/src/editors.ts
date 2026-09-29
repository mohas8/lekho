/**
 * Real editor libraries used by the launch sites, each mirroring its
 * document text into a data-doc attribute so tests can check the editor's
 * own model (not just the DOM):
 *  - Lexical (Facebook, Messenger, WhatsApp Web)
 *  - ProseMirror (the core of Tiptap; Notion/Slack-style editors)
 *  - Quill
 */
import { createEditor, $getRoot } from 'lexical';
import { registerRichText, HeadingNode, QuoteNode } from '@lexical/rich-text';
import { createEmptyHistoryState, registerHistory } from '@lexical/history';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { schema } from 'prosemirror-schema-basic';
import { history, redo, undo } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap } from 'prosemirror-commands';
import Quill from 'quill';

function lexical(host: HTMLElement): void {
  const editor = createEditor({
    namespace: 'fixture',
    nodes: [HeadingNode, QuoteNode],
    onError: (e) => {
      throw e;
    },
  });
  editor.setRootElement(host);
  registerRichText(editor);
  registerHistory(editor, createEmptyHistoryState(), 300);
  editor.registerUpdateListener(({ editorState }) => {
    host.dataset.doc = editorState.read(() => $getRoot().getTextContent());
  });
}

function prosemirror(mount: HTMLElement): void {
  const view = new EditorView(mount, {
    state: EditorState.create({
      schema,
      plugins: [history(), keymap({ 'Mod-z': undo, 'Mod-y': redo, 'Shift-Mod-z': redo }), keymap(baseKeymap)],
    }),
    attributes: { id: 'pm', role: 'textbox', 'aria-label': 'ProseMirror editor' },
    dispatchTransaction(tr) {
      view.updateState(view.state.apply(tr));
      view.dom.setAttribute('data-doc', view.state.doc.textBetween(0, view.state.doc.content.size, '\n'));
    },
  });
}

function quill(mount: HTMLElement): void {
  const q = new Quill(mount, { formats: [] });
  const editorEl = mount.querySelector<HTMLElement>('.ql-editor');
  if (!editorEl) throw new Error('quill did not render');
  editorEl.id = 'quill';
  editorEl.setAttribute('aria-label', 'Quill editor');
  q.on('text-change', () => {
    editorEl.dataset.doc = q.getText().replace(/\n$/, '');
  });
}

lexical(document.getElementById('lexical') as HTMLElement);
prosemirror(document.getElementById('pm-mount') as HTMLElement);
quill(document.getElementById('quill-mount') as HTMLElement);
document.body.dataset.ready = 'true';
