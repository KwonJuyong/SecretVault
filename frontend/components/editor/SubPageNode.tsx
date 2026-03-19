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
      <div className="subpage-block-icon">
        <FileText size={20} strokeWidth={1.7} />
      </div>
      <span className="subpage-block-title">{title}</span>
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
      pageId: {
        default: '',
        parseHTML: element => element.getAttribute('data-subpage-id') || '',
        renderHTML: attributes => ({ 'data-subpage-id': attributes.pageId }),
      },
      title: {
        default: 'Untitled',
        parseHTML: element =>
          element.getAttribute('data-subpage-title') ||
          element.textContent?.trim() ||
          'Untitled',
        renderHTML: attributes => ({ 'data-subpage-title': attributes.title }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-subpage-link]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-subpage-link': '',
        class: 'subpage-block',
      }),
      node.attrs.title || 'Untitled',
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(SubPageView);
  },
});
