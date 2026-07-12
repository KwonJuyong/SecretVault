'use client';

import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import { useState, useRef, useCallback } from 'react';

function ImageView({ node, updateAttributes, selected }: NodeViewProps) {
  const [resizing, setResizing] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing(true);
    startX.current = e.clientX;
    startWidth.current = imgRef.current?.offsetWidth || 300;

    const onMouseMove = (ev: MouseEvent) => {
      const diff = ev.clientX - startX.current;
      const newWidth = Math.max(100, startWidth.current + diff);
      if (imgRef.current) {
        imgRef.current.style.width = `${newWidth}px`;
      }
    };

    const onMouseUp = (ev: MouseEvent) => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      setResizing(false);
      const diff = ev.clientX - startX.current;
      const newWidth = Math.max(100, startWidth.current + diff);
      updateAttributes({ width: newWidth });
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [updateAttributes]);

  const width = node.attrs.width;

  return (
    <NodeViewWrapper className="resizable-image-wrapper" data-drag-handle>
      <div
        className={`resizable-image-container ${selected ? 'is-selected' : ''} ${resizing ? 'is-resizing' : ''}`}
        style={{ width: width ? `${width}px` : 'auto', maxWidth: '100%' }}
      >
        <img
          ref={imgRef}
          src={node.attrs.src}
          alt={node.attrs.alt || ''}
          title={node.attrs.title || ''}
          style={{ width: '100%', height: 'auto', display: 'block' }}
          draggable={false}
        />
        {/* Right edge resize handle */}
        <div
          className="resize-handle resize-handle-right"
          onMouseDown={onMouseDown}
        />
        {/* Bottom-right corner resize handle */}
        <div
          className="resize-handle resize-handle-corner"
          onMouseDown={onMouseDown}
        />
      </div>
    </NodeViewWrapper>
  );
}

export const ResizableImage = Node.create({
  name: 'image',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
      width: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'img[src]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const { width, ...rest } = HTMLAttributes;
    const style = width ? `width: ${width}px; max-width: 100%;` : 'max-width: 100%;';
    return ['img', mergeAttributes(rest, { style })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageView);
  },
});
