'use client';

import { Node, mergeAttributes, InputRule } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import { useState, useCallback, useEffect, useRef } from 'react';
import katex from 'katex';

// ========== Inline Math ($e^2$ style) ==========
function MathInlineView({ node, updateAttributes, selected, editor, getPos }: NodeViewProps) {
  const [editing, setEditing] = useState(!node.attrs.latex);
  const [latex, setLatex] = useState(node.attrs.latex || '');
  const inputRef = useRef<HTMLInputElement>(null);

  // Follow the node's attribute when it changes underneath us — a remote peer editing this
  // formula, or an undo. Adjusted during render: an effect would show the stale formula for
  // a frame, and the draft the user is typing would flicker back.
  const [lastLatex, setLastLatex] = useState<string>(node.attrs.latex || '');
  if (lastLatex !== (node.attrs.latex || '')) {
    setLastLatex(node.attrs.latex || '');
    setLatex(node.attrs.latex || '');
  }

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  const rendered = node.attrs.latex
    ? katex.renderToString(node.attrs.latex, { throwOnError: false, displayMode: false })
    : '';

  const handleSave = useCallback(() => {
    if (latex.trim()) {
      updateAttributes({ latex: latex.trim() });
    } else {
      const pos = getPos();
      editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run();
    }
    setEditing(false);
  }, [latex, updateAttributes, editor, getPos, node.nodeSize]);

  if (editing) {
    return (
      <NodeViewWrapper as="span" className="math-inline-wrapper">
        <input
          ref={inputRef}
          type="text"
          value={latex}
          onChange={e => setLatex(e.target.value)}
          onBlur={handleSave}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
            if (e.key === 'Escape') { setEditing(false); }
          }}
          className="math-inline-input"
          placeholder="e.g. e^{i\pi}+1=0"
        />
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      as="span"
      className={`math-inline-rendered ${selected ? 'math-selected' : ''}`}
      onClick={() => setEditing(true)}
    >
      <span dangerouslySetInnerHTML={{ __html: rendered || '<span style="color:#aaa">math</span>' }} />
    </NodeViewWrapper>
  );
}

export const MathInline = Node.create({
  name: 'mathInline',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return { latex: { default: '' } };
  },

  parseHTML() {
    return [{ tag: 'span[data-math-inline]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    // atom nodes must NOT have content hole (0)
    const attrs = mergeAttributes(HTMLAttributes, {
      'data-math-inline': '',
      'data-latex': node.attrs.latex || '',
    });
    return ['span', attrs];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathInlineView);
  },

  addInputRules() {
    return [
      // Match $...$ (inline math) - e.g. typing $e^2$ triggers this
      new InputRule({
        find: /(?<![\\$])\$([^$]+)\$$/,
        handler: ({ state, range, match }) => {
          const { tr } = state;
          tr.replaceWith(range.from, range.to, this.type.create({ latex: match[1] }));
        },
      }),
    ];
  },
});

// ========== Block Math ($$...$$ style) ==========
function MathBlockView({ node, updateAttributes, selected, editor, getPos }: NodeViewProps) {
  const [editing, setEditing] = useState(!node.attrs.latex);
  const [latex, setLatex] = useState(node.attrs.latex || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // See MathInlineView: follow the node attribute during render, not in an effect.
  const [lastLatex, setLastLatex] = useState<string>(node.attrs.latex || '');
  if (lastLatex !== (node.attrs.latex || '')) {
    setLastLatex(node.attrs.latex || '');
    setLatex(node.attrs.latex || '');
  }

  useEffect(() => {
    if (editing && textareaRef.current) textareaRef.current.focus();
  }, [editing]);

  const rendered = node.attrs.latex
    ? katex.renderToString(node.attrs.latex, { throwOnError: false, displayMode: true })
    : '';

  const handleSave = useCallback(() => {
    if (latex.trim()) {
      updateAttributes({ latex: latex.trim() });
      setEditing(false);
    } else {
      const pos = getPos();
      editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run();
    }
  }, [latex, updateAttributes, editor, getPos, node.nodeSize]);

  if (editing) {
    return (
      <NodeViewWrapper className="math-block-wrapper math-editing">
        <div className="math-block-label">Block Math (LaTeX) - Ctrl+Enter to save</div>
        <textarea
          ref={textareaRef}
          value={latex}
          onChange={e => setLatex(e.target.value)}
          onBlur={handleSave}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleSave(); }
            if (e.key === 'Escape') { handleSave(); }
          }}
          className="math-block-input"
          placeholder="e.g. \int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}"
          rows={3}
        />
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      className={`math-block-wrapper math-block-rendered ${selected ? 'math-selected' : ''}`}
      onClick={() => setEditing(true)}
    >
      <div dangerouslySetInnerHTML={{ __html: rendered || '<span style="color:#aaa">Click to add equation</span>' }} />
    </NodeViewWrapper>
  );
}

export const MathBlock = Node.create({
  name: 'mathBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return { latex: { default: '' } };
  },

  parseHTML() {
    return [{ tag: 'div[data-math-block]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    // atom nodes must NOT have content hole (0)
    const attrs = mergeAttributes(HTMLAttributes, {
      'data-math-block': '',
      'data-latex': node.attrs.latex || '',
    });
    return ['div', attrs];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathBlockView);
  },

  addInputRules() {
    return [
      // Match $$...$$ (block math) - e.g. typing $$\frac{1}{2}$$ triggers this
      new InputRule({
        find: /^\$\$([^$]+)\$\$$/,
        handler: ({ state, range, match }) => {
          const { tr } = state;
          tr.replaceWith(range.from, range.to, this.type.create({ latex: match[1] }));
        },
      }),
    ];
  },
});
