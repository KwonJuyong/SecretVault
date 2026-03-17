'use client';

import { Node, mergeAttributes, InputRule } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import { useState, useCallback, useEffect, useRef } from 'react';
import katex from 'katex';

// ========== Inline Math ==========
function MathInlineView({ node, updateAttributes, selected, editor, getPos }: any) {
  const [editing, setEditing] = useState(!node.attrs.latex);
  const [latex, setLatex] = useState(node.attrs.latex || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
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
      <span dangerouslySetInnerHTML={{ __html: rendered }} />
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

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-math-inline': '' }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathInlineView);
  },

  addInputRules() {
    return [
      new InputRule({
        find: /(?<![\\$])\$([^$\s][^$]*[^$\s]|[^$\s])\$$/,
        handler: ({ state, range, match }) => {
          const { tr } = state;
          tr.replaceWith(range.from, range.to, this.type.create({ latex: match[1] }));
        },
      }),
    ];
  },
});

// ========== Block Math ==========
function MathBlockView({ node, updateAttributes, selected, editor, getPos }: any) {
  const [editing, setEditing] = useState(!node.attrs.latex);
  const [latex, setLatex] = useState(node.attrs.latex || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
    }
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
        <div className="math-block-label">Block Math (LaTeX)</div>
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
          placeholder="LaTeX expression (Ctrl+Enter to confirm)"
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
      <div dangerouslySetInnerHTML={{ __html: rendered }} />
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

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-math-block': '' }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathBlockView);
  },

  addInputRules() {
    return [
      new InputRule({
        find: /^\$\$\s$/,
        handler: ({ state, range }) => {
          const { tr } = state;
          tr.replaceWith(range.from, range.to, this.type.create({ latex: '' }));
        },
      }),
    ];
  },
});
