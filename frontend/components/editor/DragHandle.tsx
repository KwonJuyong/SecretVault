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
          handle.draggable = true;
          handle.innerHTML = `<svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
            <circle cx="2" cy="2" r="1.2"/><circle cx="8" cy="2" r="1.2"/>
            <circle cx="2" cy="7" r="1.2"/><circle cx="8" cy="7" r="1.2"/>
            <circle cx="2" cy="12" r="1.2"/><circle cx="8" cy="12" r="1.2"/>
          </svg>`;
          handle.style.display = 'none';

          const dropLine = document.createElement('div');
          dropLine.className = 'block-drop-indicator';
          dropLine.style.display = 'none';

          const wrapper = editorView.dom.parentElement;
          if (wrapper) {
            wrapper.style.position = 'relative';
            wrapper.appendChild(handle);
            wrapper.appendChild(dropLine);
          }

          let currentBlockPos: number | null = null;
          let currentBlockDom: HTMLElement | null = null;
          let isDragging = false;

          const positionHandle = (blockEl: HTMLElement) => {
            if (!wrapper) return;
            const wrapperRect = wrapper.getBoundingClientRect();
            const editorRect = editorView.dom.getBoundingClientRect();
            const blockRect = blockEl.getBoundingClientRect();
            handle.style.display = 'flex';
            handle.style.top = `${blockRect.top - wrapperRect.top + wrapper.scrollTop + 2}px`;
            handle.style.left = `${editorRect.left - wrapperRect.left - 26}px`;
          };

          // Mousedown: select the block (don't preventDefault — allow drag to start)
          handle.addEventListener('mousedown', () => {
            if (currentBlockPos === null) return;
            try {
              const tr = editorView.state.tr.setSelection(
                NodeSelection.create(editorView.state.doc, currentBlockPos)
              );
              editorView.dispatch(tr);
            } catch { /* ignore */ }
          });

          // Dragstart: set ProseMirror's dragging state
          handle.addEventListener('dragstart', (e) => {
            if (currentBlockPos === null) return;
            isDragging = true;
            handle.style.display = 'none';

            try {
              const { state } = editorView;
              // Ensure NodeSelection
              if (!(state.selection instanceof NodeSelection)) {
                const tr = state.tr.setSelection(
                  NodeSelection.create(state.doc, currentBlockPos)
                );
                editorView.dispatch(tr);
              }

              const slice = editorView.state.selection.content();
              e.dataTransfer!.effectAllowed = 'move';
              e.dataTransfer!.setData('application/x-prosemirror-drag', 'true');

              // Set ProseMirror's internal dragging state
              (editorView as any).dragging = { slice, move: true };
            } catch { /* ignore */ }
          });

          handle.addEventListener('dragend', () => {
            isDragging = false;
            dropLine.style.display = 'none';
            currentBlockDom = null;
            currentBlockPos = null;
          });

          // Show drop indicator while dragging over editor
          editorView.dom.addEventListener('dragover', (e) => {
            if (!isDragging || !wrapper) return;
            e.preventDefault();
            e.dataTransfer!.dropEffect = 'move';

            // Find the nearest block boundary
            const pos = editorView.posAtCoords({ left: e.clientX, top: e.clientY });
            if (!pos) return;

            try {
              const $pos = editorView.state.doc.resolve(pos.pos);
              const before = $pos.before($pos.depth >= 1 ? 1 : 0);
              const domNode = editorView.nodeDOM(before >= 0 ? before : 0) as HTMLElement;
              if (!domNode) return;

              const wrapperRect = wrapper.getBoundingClientRect();
              const nodeRect = domNode.getBoundingClientRect();
              const editorRect = editorView.dom.getBoundingClientRect();
              const midY = nodeRect.top + nodeRect.height / 2;

              let lineY: number;
              if (e.clientY < midY) {
                lineY = nodeRect.top - wrapperRect.top + wrapper.scrollTop;
              } else {
                lineY = nodeRect.bottom - wrapperRect.top + wrapper.scrollTop;
              }

              dropLine.style.display = 'block';
              dropLine.style.top = `${lineY}px`;
              dropLine.style.left = `${editorRect.left - wrapperRect.left}px`;
              dropLine.style.width = `${editorRect.width}px`;
            } catch {
              dropLine.style.display = 'none';
            }
          });

          editorView.dom.addEventListener('dragleave', () => {
            dropLine.style.display = 'none';
          });

          editorView.dom.addEventListener('drop', () => {
            isDragging = false;
            dropLine.style.display = 'none';
          });

          const onMouseMove = (e: MouseEvent) => {
            if (isDragging) return;
            const target = e.target as HTMLElement;
            if (handle.contains(target)) return;

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
            if (isDragging) return;
            const related = e.relatedTarget as HTMLElement;
            if (related && handle.contains(related)) return;
            setTimeout(() => {
              if (!handle.matches(':hover') && !isDragging) {
                handle.style.display = 'none';
                currentBlockDom = null;
                currentBlockPos = null;
              }
            }, 100);
          };

          editorView.dom.addEventListener('mousemove', onMouseMove);
          editorView.dom.addEventListener('mouseleave', onMouseLeave);

          handle.addEventListener('mouseleave', (e) => {
            if (isDragging) return;
            const related = e.relatedTarget as HTMLElement;
            if (related && editorView.dom.contains(related)) return;
            handle.style.display = 'none';
            currentBlockDom = null;
            currentBlockPos = null;
          });

          return {
            update() {
              if (currentBlockDom && handle.style.display !== 'none' && !isDragging) {
                positionHandle(currentBlockDom);
              }
            },
            destroy() {
              handle.remove();
              dropLine.remove();
              editorView.dom.removeEventListener('mousemove', onMouseMove);
              editorView.dom.removeEventListener('mouseleave', onMouseLeave);
            },
          };
        },
      }),
    ];
  },
});
