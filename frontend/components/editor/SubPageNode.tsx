'use client';

import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import { FileText } from 'lucide-react';

function SubPageView({ node }: any) {
  const title = node.attrs.title || 'Untitled';

  return (
    <NodeViewWrapper
      className="subpage-block"
      data-subpage-id={node.attrs.pageId}
      contentEditable={false}
    >
      <FileText size={16} />
      <span>{title}</span>
    </NodeViewWrapper>
  );
}

export const SubPageNode = Node.create({
  name: 'subPageLink',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      pageId: { default: '' },
      title: { default: 'Untitled' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-subpage-link]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-subpage-link': '',
      'data-subpage-id': node.attrs.pageId,
      class: 'subpage-block',
    })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(SubPageView);
  },
});
