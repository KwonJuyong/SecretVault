'use client';

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { NodeSelection } from '@tiptap/pm/state';
import { Node as PMNode } from '@tiptap/pm/model';

export const DragHandle = Extension.create({
  name: 'dragHandle',

  addProseMirrorPlugins() {
    // Shared drag state between plugin props and view
    let isDragging = false;
    let dragStartPos: number | null = null;
    let dragNode: PMNode | null = null;
    let currentBlockPos: number | null = null;
    let currentBlockDom: HTMLElement | null = null;
    let handleEl: HTMLDivElement | null = null;
    let dropLineEl: HTMLDivElement | null = null;
    let wrapperEl: HTMLElement | null = null;

    const findDropTarget = (view: any, clientY: number): { pos: number; after: boolean } | null => {
      const doc = view.state.doc;
      let result: { pos: number; after: boolean } | null = null;
      doc.forEach((node: PMNode, offset: number) => {
        try {
          const dom = view.nodeDOM(offset) as HTMLElement;
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

    const showDropLine = (view: any, target: { pos: number; after: boolean }) => {
      if (!dropLineEl || !wrapperEl) return;
      try {
        const dom = view.nodeDOM(target.pos) as HTMLElement;
        if (!dom) return;
        const wrapperRect = wrapperEl.getBoundingClientRect();
        const editorRect = view.dom.getBoundingClientRect();
        const nodeRect = dom.getBoundingClientRect();
        const lineY = target.after
          ? nodeRect.bottom - wrapperRect.top + wrapperEl.scrollTop
          : nodeRect.top - wrapperRect.top + wrapperEl.scrollTop;
        dropLineEl.style.display = 'block';
        dropLineEl.style.top = `${lineY}px`;
        dropLineEl.style.left = `${editorRect.left - wrapperRect.left}px`;
        dropLineEl.style.width = `${editorRect.width}px`;
      } catch {
        dropLineEl.style.display = 'none';
      }
    };

    const hideDropLine = () => {
      if (dropLineEl) dropLineEl.style.display = 'none';
    };

    const resetDragState = () => {
      isDragging = false;
      dragStartPos = null;
      dragNode = null;
      hideDropLine();
    };

    return [
      new Plugin({
        key: new PluginKey('dragHandle'),
        props: {
          // Handle drag events at ProseMirror level to avoid conflicts
          handleDOMEvents: {
            dragover(view, event) {
              if (!isDragging || !wrapperEl) return false;
              event.preventDefault();
              event.dataTransfer!.dropEffect = 'move';
              const target = findDropTarget(view, event.clientY);
              if (target) {
                showDropLine(view, target);
              } else {
                hideDropLine();
              }
              return true;
            },
            drop(view, event) {
              if (!isDragging || dragStartPos === null || !dragNode) return false;
              event.preventDefault();
              event.stopPropagation();

              const target = findDropTarget(view, event.clientY);
              if (!target) {
                resetDragState();
                return true;
              }

              try {
                const { state } = view;
                const node = state.doc.nodeAt(dragStartPos);
                if (!node) { resetDragState(); return true; }

                const nodeSize = node.nodeSize;
                const targetNode = state.doc.nodeAt(target.pos);
                if (!targetNode) { resetDragState(); return true; }

                let insertPos = target.after ? target.pos + targetNode.nodeSize : target.pos;

                // Don't drop on itself
                if (insertPos >= dragStartPos && insertPos <= dragStartPos + nodeSize) {
                  resetDragState();
                  return true;
                }

                const tr = state.tr;
                if (dragStartPos < insertPos) {
                  tr.insert(insertPos, node);
                  tr.delete(dragStartPos, dragStartPos + nodeSize);
                } else {
                  tr.delete(dragStartPos, dragStartPos + nodeSize);
                  tr.insert(insertPos, node);
                }
                view.dispatch(tr);
              } catch { /* ignore */ }

              resetDragState();
              return true;
            },
            dragleave(view, event) {
              if (!isDragging) return false;
              const related = (event as DragEvent).relatedTarget as HTMLElement;
              if (related && view.dom.contains(related)) return false;
              hideDropLine();
              return false;
            },
          },
        },
        view(editorView) {
          handleEl = document.createElement('div');
          handleEl.className = 'block-drag-handle';
          handleEl.draggable = true;
          handleEl.innerHTML = `<svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
            <circle cx="2" cy="2" r="1.2"/><circle cx="8" cy="2" r="1.2"/>
            <circle cx="2" cy="7" r="1.2"/><circle cx="8" cy="7" r="1.2"/>
            <circle cx="2" cy="12" r="1.2"/><circle cx="8" cy="12" r="1.2"/>
          </svg>`;
          handleEl.style.display = 'none';

          dropLineEl = document.createElement('div');
          dropLineEl.className = 'block-drop-indicator';
          dropLineEl.style.display = 'none';

          wrapperEl = editorView.dom.parentElement;
          if (wrapperEl) {
            wrapperEl.style.position = 'relative';
            wrapperEl.appendChild(handleEl);
            wrapperEl.appendChild(dropLineEl);
          }

          const positionHandle = (blockEl: HTMLElement) => {
            if (!wrapperEl || !handleEl) return;
            const wrapperRect = wrapperEl.getBoundingClientRect();
            const editorRect = editorView.dom.getBoundingClientRect();
            const blockRect = blockEl.getBoundingClientRect();
            handleEl.style.display = 'flex';
            handleEl.style.top = `${blockRect.top - wrapperRect.top + wrapperEl.scrollTop + 2}px`;
            handleEl.style.left = `${editorRect.left - wrapperRect.left - 26}px`;
          };

          // Mousedown: select block for drag
          handleEl.addEventListener('mousedown', () => {
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

          handleEl.addEventListener('dragstart', (e) => {
            if (dragStartPos === null || !dragNode) return;
            isDragging = true;
            handleEl!.style.display = 'none';
            e.dataTransfer!.effectAllowed = 'move';
            e.dataTransfer!.setData('application/x-block-drag', 'true');

            // Create drag ghost from the block being dragged
            if (currentBlockDom) {
              const ghost = currentBlockDom.cloneNode(true) as HTMLElement;
              ghost.style.position = 'absolute';
              ghost.style.top = '-9999px';
              ghost.style.opacity = '0.7';
              ghost.style.width = `${currentBlockDom.offsetWidth}px`;
              ghost.style.background = 'white';
              ghost.style.borderRadius = '6px';
              ghost.style.padding = '4px 8px';
              ghost.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)';
              document.body.appendChild(ghost);
              e.dataTransfer!.setDragImage(ghost, 0, 0);
              requestAnimationFrame(() => ghost.remove());
            }
          });

          handleEl.addEventListener('dragend', () => {
            resetDragState();
            currentBlockDom = null;
            currentBlockPos = null;
          });

          // Track which block the mouse is hovering over
          const onMouseMove = (e: MouseEvent) => {
            if (isDragging) return;
            const target = e.target as HTMLElement;
            if (handleEl && handleEl.contains(target)) return;

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
                // Always resolve to depth 1 (top-level block)
                currentBlockPos = resolved.before(Math.max(1, Math.min(resolved.depth, 1)));
                if (currentBlockPos < 0) currentBlockPos = 0;
                positionHandle(blockEl);
              } catch {
                if (handleEl) handleEl.style.display = 'none';
                currentBlockPos = null;
              }
            }
          };

          const onMouseLeave = (e: MouseEvent) => {
            if (isDragging) return;
            const related = e.relatedTarget as HTMLElement;
            if (related && handleEl && handleEl.contains(related)) return;
            setTimeout(() => {
              if (handleEl && !handleEl.matches(':hover') && !isDragging) {
                handleEl.style.display = 'none';
                currentBlockDom = null;
                currentBlockPos = null;
              }
            }, 100);
          };

          editorView.dom.addEventListener('mousemove', onMouseMove);
          editorView.dom.addEventListener('mouseleave', onMouseLeave);

          handleEl.addEventListener('mouseleave', (e) => {
            if (isDragging) return;
            const related = e.relatedTarget as HTMLElement;
            if (related && editorView.dom.contains(related)) return;
            if (handleEl) {
              handleEl.style.display = 'none';
              currentBlockDom = null;
              currentBlockPos = null;
            }
          });

          return {
            update() {
              if (currentBlockDom && handleEl && handleEl.style.display !== 'none' && !isDragging) {
                positionHandle(currentBlockDom);
              }
            },
            destroy() {
              if (handleEl) handleEl.remove();
              if (dropLineEl) dropLineEl.remove();
              editorView.dom.removeEventListener('mousemove', onMouseMove);
              editorView.dom.removeEventListener('mouseleave', onMouseLeave);
            },
          };
        },
      }),
    ];
  },
});
