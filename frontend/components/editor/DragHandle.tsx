'use client';

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { NodeSelection } from '@tiptap/pm/state';
import { Node as PMNode } from '@tiptap/pm/model';

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
          let dragStartPos: number | null = null;
          let dragNode: PMNode | null = null;

          const positionHandle = (blockEl: HTMLElement) => {
            if (!wrapper) return;
            const wrapperRect = wrapper.getBoundingClientRect();
            const editorRect = editorView.dom.getBoundingClientRect();
            const blockRect = blockEl.getBoundingClientRect();
            handle.style.display = 'flex';
            handle.style.top = `${blockRect.top - wrapperRect.top + wrapper.scrollTop + 2}px`;
            handle.style.left = `${editorRect.left - wrapperRect.left - 26}px`;
          };

          const findDropTarget = (clientY: number): { pos: number; after: boolean } | null => {
            const doc = editorView.state.doc;
            let result: { pos: number; after: boolean } | null = null;

            doc.forEach((node, offset) => {
              try {
                const dom = editorView.nodeDOM(offset) as HTMLElement;
                if (!dom || !dom.getBoundingClientRect) return;
                const rect = dom.getBoundingClientRect();
                const mid = rect.top + rect.height / 2;
                if (clientY >= rect.top && clientY <= rect.bottom) {
                  result = { pos: offset, after: clientY > mid };
                } else if (clientY > rect.bottom) {
                  result = { pos: offset, after: true };
                }
              } catch { /* skip */ }
            });

            return result;
          };

          // Mousedown: select block, store drag info
          handle.addEventListener('mousedown', () => {
            if (currentBlockPos === null) return;
            try {
              dragStartPos = currentBlockPos;
              dragNode = editorView.state.doc.nodeAt(currentBlockPos);
              const tr = editorView.state.tr.setSelection(
                NodeSelection.create(editorView.state.doc, currentBlockPos)
              );
              editorView.dispatch(tr);
            } catch { /* ignore */ }
          });

          handle.addEventListener('dragstart', (e) => {
            if (dragStartPos === null || !dragNode) return;
            isDragging = true;
            handle.style.display = 'none';
            e.dataTransfer!.effectAllowed = 'move';
            e.dataTransfer!.setData('text/plain', '');
          });

          handle.addEventListener('dragend', () => {
            isDragging = false;
            dragStartPos = null;
            dragNode = null;
            dropLine.style.display = 'none';
            currentBlockDom = null;
            currentBlockPos = null;
          });

          // Dragover on editor: show drop indicator
          editorView.dom.addEventListener('dragover', (e) => {
            if (!isDragging || !wrapper) return;
            e.preventDefault();
            e.dataTransfer!.dropEffect = 'move';

            const target = findDropTarget(e.clientY);
            if (!target) { dropLine.style.display = 'none'; return; }

            try {
              const dom = editorView.nodeDOM(target.pos) as HTMLElement;
              if (!dom) return;
              const wrapperRect = wrapper.getBoundingClientRect();
              const editorRect = editorView.dom.getBoundingClientRect();
              const nodeRect = dom.getBoundingClientRect();

              const lineY = target.after
                ? nodeRect.bottom - wrapperRect.top + wrapper.scrollTop
                : nodeRect.top - wrapperRect.top + wrapper.scrollTop;

              dropLine.style.display = 'block';
              dropLine.style.top = `${lineY}px`;
              dropLine.style.left = `${editorRect.left - wrapperRect.left}px`;
              dropLine.style.width = `${editorRect.width}px`;
            } catch {
              dropLine.style.display = 'none';
            }
          });

          editorView.dom.addEventListener('dragleave', (e) => {
            const related = e.relatedTarget as HTMLElement;
            if (related && editorView.dom.contains(related)) return;
            dropLine.style.display = 'none';
          });

          // Drop: manually move the block
          editorView.dom.addEventListener('drop', (e) => {
            if (!isDragging || dragStartPos === null || !dragNode) return;
            e.preventDefault();
            e.stopPropagation();

            const target = findDropTarget(e.clientY);
            if (!target) { isDragging = false; dropLine.style.display = 'none'; return; }

            try {
              const { state } = editorView;
              const node = state.doc.nodeAt(dragStartPos);
              if (!node) return;

              const nodeSize = node.nodeSize;
              const targetNode = state.doc.nodeAt(target.pos);
              if (!targetNode) return;

              // Calculate insert position
              let insertPos = target.after ? target.pos + targetNode.nodeSize : target.pos;

              // Don't drop on itself
              if (insertPos >= dragStartPos && insertPos <= dragStartPos + nodeSize) {
                isDragging = false;
                dropLine.style.display = 'none';
                return;
              }

              const tr = state.tr;

              if (dragStartPos < insertPos) {
                // Dragging down: insert first, then delete (positions shift)
                tr.insert(insertPos, node);
                tr.delete(dragStartPos, dragStartPos + nodeSize);
              } else {
                // Dragging up: delete first, then insert
                tr.delete(dragStartPos, dragStartPos + nodeSize);
                tr.insert(insertPos, node);
              }

              editorView.dispatch(tr);
            } catch { /* ignore */ }

            isDragging = false;
            dragStartPos = null;
            dragNode = null;
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
