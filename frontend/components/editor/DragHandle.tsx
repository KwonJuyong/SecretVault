'use client';

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { NodeSelection } from '@tiptap/pm/state';

export const DragHandle = Extension.create({
  name: 'dragHandle',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('dragHandle'),
        view(editorView) {
          const handle = document.createElement('div');
          handle.className = 'block-drag-handle';
          handle.innerHTML = `<svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
            <circle cx="2" cy="2" r="1.2"/><circle cx="8" cy="2" r="1.2"/>
            <circle cx="2" cy="7" r="1.2"/><circle cx="8" cy="7" r="1.2"/>
            <circle cx="2" cy="12" r="1.2"/><circle cx="8" cy="12" r="1.2"/>
          </svg>`;
          handle.contentEditable = 'false';
          handle.draggable = true;
          handle.style.display = 'none';

          // Append to the ProseMirror DOM's parent (the wrapper with padding)
          const wrapper = editorView.dom.parentElement;
          if (wrapper) {
            wrapper.style.position = 'relative';
            wrapper.appendChild(handle);
          }

          let currentBlockPos: number | null = null;
          let currentBlockDom: HTMLElement | null = null;

          const positionHandle = (blockEl: HTMLElement) => {
            if (!wrapper) return;
            const wrapperRect = wrapper.getBoundingClientRect();
            const editorRect = editorView.dom.getBoundingClientRect();
            const blockRect = blockEl.getBoundingClientRect();

            handle.style.display = 'flex';
            handle.style.top = `${blockRect.top - wrapperRect.top + wrapper.scrollTop}px`;
            // Position to the left of the content area
            handle.style.left = `${editorRect.left - wrapperRect.left - 24}px`;
          };

          // Mouse down on handle → select the block node
          handle.addEventListener('mousedown', (e) => {
            if (currentBlockPos === null) return;
            e.preventDefault();
            try {
              const node = editorView.state.doc.nodeAt(currentBlockPos);
              if (node) {
                const tr = editorView.state.tr.setSelection(
                  NodeSelection.create(editorView.state.doc, currentBlockPos)
                );
                editorView.dispatch(tr);
              }
            } catch { /* ignore */ }
          });

          // Drag start → ProseMirror handles the drag with NodeSelection
          handle.addEventListener('dragstart', (e) => {
            if (currentBlockPos === null) return;
            try {
              const node = editorView.state.doc.nodeAt(currentBlockPos);
              if (!node) return;
              // Ensure NodeSelection is active
              if (!(editorView.state.selection instanceof NodeSelection)) {
                const tr = editorView.state.tr.setSelection(
                  NodeSelection.create(editorView.state.doc, currentBlockPos)
                );
                editorView.dispatch(tr);
              }
              // Let ProseMirror handle the rest via its drag handlers
              const slice = editorView.state.selection.content();
              e.dataTransfer?.setData('text/plain', '');
              // Set the ProseMirror dragging state
              (editorView as any).dragging = {
                slice,
                move: true,
              };
            } catch { /* ignore */ }
          });

          const onMouseMove = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (handle.contains(target)) return;

            // Find the top-level block element
            let blockEl: HTMLElement | null = null;
            let el: HTMLElement | null = target;
            while (el && el !== editorView.dom) {
              if (el.parentElement === editorView.dom) {
                blockEl = el;
                break;
              }
              el = el.parentElement;
            }

            if (blockEl && blockEl !== currentBlockDom) {
              currentBlockDom = blockEl;
              try {
                const pos = editorView.posAtDOM(blockEl, 0);
                const resolved = editorView.state.doc.resolve(pos);
                currentBlockPos = resolved.before(resolved.depth >= 1 ? 1 : 0);
                if (currentBlockPos < 0) currentBlockPos = 0;
                positionHandle(blockEl);
              } catch {
                handle.style.display = 'none';
                currentBlockPos = null;
              }
            }
          };

          const onMouseLeave = (e: MouseEvent) => {
            const related = e.relatedTarget as HTMLElement;
            if (related && handle.contains(related)) return;
            setTimeout(() => {
              if (!handle.matches(':hover')) {
                handle.style.display = 'none';
                currentBlockDom = null;
                currentBlockPos = null;
              }
            }, 100);
          };

          editorView.dom.addEventListener('mousemove', onMouseMove);
          editorView.dom.addEventListener('mouseleave', onMouseLeave);

          handle.addEventListener('mouseleave', (e) => {
            const related = e.relatedTarget as HTMLElement;
            if (related && editorView.dom.contains(related)) return;
            handle.style.display = 'none';
            currentBlockDom = null;
            currentBlockPos = null;
          });

          return {
            update() {
              if (currentBlockDom && handle.style.display !== 'none') {
                positionHandle(currentBlockDom);
              }
            },
            destroy() {
              handle.remove();
              editorView.dom.removeEventListener('mousemove', onMouseMove);
              editorView.dom.removeEventListener('mouseleave', onMouseLeave);
            },
          };
        },
      }),
    ];
  },
});
