/**
 * React fixture: a controlled input and a contenteditable whose text is
 * mirrored into React state, to check that frameworks see our edits.
 */
import { createElement as h, useState } from 'react';
import { createRoot } from 'react-dom/client';

function App() {
  const [text, setText] = useState('');
  const [rich, setRich] = useState('');
  return h(
    'main',
    null,
    h('h1', null, 'React fixture'),
    h('label', { htmlFor: 'react-input' }, 'Controlled input'),
    h('input', {
      id: 'react-input',
      value: text,
      onChange: (e: { target: HTMLInputElement }) => setText(e.target.value),
    }),
    h('output', { id: 'react-input-state' }, text),
    h('h2', { id: 'react-ce-label' }, 'Contenteditable mirrored into state'),
    h('div', {
      id: 'react-ce',
      role: 'textbox',
      'aria-labelledby': 'react-ce-label',
      contentEditable: true,
      suppressContentEditableWarning: true,
      onInput: (e: { currentTarget: HTMLDivElement }) => setRich(e.currentTarget.textContent ?? ''),
      style: { border: '1px solid #888', minHeight: '1.5rem', width: '30rem' },
    }),
    h('output', { id: 'react-ce-state' }, rich),
  );
}

createRoot(document.getElementById('root') as HTMLElement).render(h(App));
