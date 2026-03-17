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
          handle.style.display = 'none';

          // Move up/down buttons
          const moveUp = document.createElement('button');
          moveUp.className = 'block-move-btn';
          moveUp.innerHTML = '&#9650;';
          moveUp.title = 'Move up';

          const moveDown = document.createElement('button');
          moveDown.className = 'block-move-btn';
          moveDown.innerHTML = '&#9660;';
          moveDown.title = 'Move down';

          const container = document.createElement('div');
          container.className = 'block-handle-group';
          container.style.display = 'none';
          container.appendChild(moveUp);
          container.appendChild(handle);
          container.appendChild(moveDown);

          const wrapper = editorView.dom.parentElement;
          if (wrapper) {
            wrapper.style.position = 'relative';
            wrapper.appendChild(container);
          }

          let currentBlockPos: number | null = null;
          let currentBlockDom: HTMLElement | null = null;

          const positionContainer = (blockEl: HTMLElement) => {
            if (!wrapper) return;
            const wrapperRect = wrapper.getBoundingClientRect();
            const editorRect = editorView.dom.getBoundingClientRect();
            const blockRect = blockEl.getBoundingClientRect();

            container.style.display = 'flex';
            container.style.top = `${blockRect.top - wrapperRect.top + wrapper.scrollTop}px`;
            container.style.left = `${editorRect.left - wrapperRect.left - 32}px`;
            container.style.height = `${blockRect.height}px`;
          };

          // Move block up
          moveUp.addEventListener('mousedown', (e) => {
            e.preventDefault();
            if (currentBlockPos === null) return;
            const { state, dispatch } = editorView;
            const $pos = state.doc.resolve(currentBlockPos);
            if ($pos.index($pos.depth) === 0) return; // already first
            try {
              const node = state.doc.nodeAt(currentBlockPos);
              if (!node) return;
              const nodeBefore = $pos.nodeBefore;
              if (!nodeBefore) return;
              const beforePos = currentBlockPos - nodeBefore.nodeSize;
              const tr = state.tr;
              tr.delete(currentBlockPos, currentBlockPos + node.nodeSize);
              tr.insert(beforePos, node);
              tr.setSelection(NodeSelection.create(tr.doc, beforePos));
              dispatch(tr);
              currentBlockPos = beforePos;
            } catch { /* ignore */ }
          });

          // Move block down
          moveDown.addEventListener('mousedown', (e) => {
            e.preventDefault();
            if (currentBlockPos === null) return;
            const { state, dispatch } = editorView;
            try {
              const node = state.doc.nodeAt(currentBlockPos);
              if (!node) return;
              const afterPos = currentBlockPos + node.nodeSize;
              if (afterPos >= state.doc.content.size) return; // already last
              const nodeAfter = state.doc.nodeAt(afterPos);
              if (!nodeAfter) return;
              const tr = state.tr;
              tr.delete(afterPos, afterPos + nodeAfter.nodeSize);
              tr.insert(currentBlockPos, nodeAfter);
              const newPos = currentBlockPos + nodeAfter.nodeSize;
              tr.setSelection(NodeSelection.create(tr.doc, newPos));
              dispatch(tr);
              currentBlockPos = newPos;
            } catch { /* ignore */ }
          });

          // Select block on handle click
          handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            if (currentBlockPos === null) return;
            try {
              const tr = editorView.state.tr.setSelection(
                NodeSelection.create(editorView.state.doc, currentBlockPos)
              );
              editorView.dispatch(tr);
            } catch { /* ignore */ }
          });

          const onMouseMove = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (container.contains(target)) return;

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
                positionContainer(blockEl);
              } catch {
                container.style.display = 'none';
                currentBlockPos = null;
              }
            }
          };

          const onMouseLeave = (e: MouseEvent) => {
            const related = e.relatedTarget as HTMLElement;
            if (related && container.contains(related)) return;
            setTimeout(() => {
              if (!container.matches(':hover')) {
                container.style.display = 'none';
                currentBlockDom = null;
                currentBlockPos = null;
              }
            }, 100);
          };

          editorView.dom.addEventListener('mousemove', onMouseMove);
          editorView.dom.addEventListener('mouseleave', onMouseLeave);

          container.addEventListener('mouseleave', (e) => {
            const related = e.relatedTarget as HTMLElement;
            if (related && editorView.dom.contains(related)) return;
            container.style.display = 'none';
            currentBlockDom = null;
            currentBlockPos = null;
          });

          return {
            update() {
              if (currentBlockDom && container.style.display !== 'none') {
                positionContainer(currentBlockDom);
              }
            },
            destroy() {
              container.remove();
              editorView.dom.removeEventListener('mousemove', onMouseMove);
              editorView.dom.removeEventListener('mouseleave', onMouseLeave);
            },
          };
        },
      }),
    ];
  },
});
