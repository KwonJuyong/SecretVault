'use client';

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Node as PMNode } from '@tiptap/pm/model';

export const DragHandle = Extension.create({
  name: 'dragHandle',

  addProseMirrorPlugins() {
    let isDragging = false;
    let dragStartPos: number | null = null;
    let dragNode: PMNode | null = null;
    let currentBlockPos: number | null = null;
    let currentBlockDom: HTMLElement | null = null;
    let handleEl: HTMLDivElement | null = null;
    let dropLineEl: HTMLDivElement | null = null;
    let scrollEl: HTMLElement | null = null;

    const findScrollParent = (el: HTMLElement | null): HTMLElement => {
      while (el) {
        const overflow = getComputedStyle(el).overflowY;
        if (overflow === 'auto' || overflow === 'scroll') return el;
        el = el.parentElement;
      }
      return document.documentElement;
    };

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
      if (!dropLineEl || !scrollEl) return;
      try {
        const dom = view.nodeDOM(target.pos) as HTMLElement;
        if (!dom) return;
        const scrollRect = scrollEl.getBoundingClientRect();
        const nodeRect = dom.getBoundingClientRect();
        const editorRect = view.dom.getBoundingClientRect();
        const lineY = target.after
          ? nodeRect.bottom - scrollRect.top + scrollEl.scrollTop
          : nodeRect.top - scrollRect.top + scrollEl.scrollTop;
        dropLineEl.style.display = 'block';
        dropLineEl.style.top = `${lineY}px`;
        dropLineEl.style.left = `${editorRect.left - scrollRect.left}px`;
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
      if (currentBlockDom) {
        currentBlockDom.style.opacity = '';
      }
    };

    return [
      new Plugin({
        key: new PluginKey('dragHandle'),
        props: {
          handleDOMEvents: {
            dragover(view, event) {
              if (!isDragging) return false;
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
          scrollEl = findScrollParent(editorView.dom);

          handleEl = document.createElement('div');
          handleEl.className = 'block-drag-handle';
          handleEl.draggable = true;
          handleEl.innerHTML = `<svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
            <circle cx="2" cy="2" r="1.3"/><circle cx="8" cy="2" r="1.3"/>
            <circle cx="2" cy="7" r="1.3"/><circle cx="8" cy="7" r="1.3"/>
            <circle cx="2" cy="12" r="1.3"/><circle cx="8" cy="12" r="1.3"/>
          </svg>`;
          handleEl.style.display = 'none';

          dropLineEl = document.createElement('div');
          dropLineEl.className = 'block-drop-indicator';
          dropLineEl.style.display = 'none';

          if (scrollEl) {
            const pos = getComputedStyle(scrollEl).position;
            if (pos === 'static') scrollEl.style.position = 'relative';
            scrollEl.appendChild(handleEl);
            scrollEl.appendChild(dropLineEl);
          }

          const positionHandle = (blockEl: HTMLElement) => {
            if (!scrollEl || !handleEl) return;
            const scrollRect = scrollEl.getBoundingClientRect();
            const editorRect = editorView.dom.getBoundingClientRect();
            const blockRect = blockEl.getBoundingClientRect();
            const top = blockRect.top - scrollRect.top + scrollEl.scrollTop;
            const left = editorRect.left - scrollRect.left - 28;
            handleEl.style.display = 'flex';
            handleEl.style.top = `${top + 2}px`;
            handleEl.style.left = `${Math.max(4, left)}px`;
          };

          handleEl.addEventListener('mousedown', (e) => {
            e.preventDefault();
            if (currentBlockPos === null) return;
            try {
              dragStartPos = currentBlockPos;
              dragNode = editorView.state.doc.nodeAt(currentBlockPos);
            } catch { /* ignore */ }
          });

          handleEl.addEventListener('dragstart', (e) => {
            if (dragStartPos === null || !dragNode) return;
            isDragging = true;
            e.dataTransfer!.effectAllowed = 'move';
            e.dataTransfer!.setData('text/plain', '');
            e.dataTransfer!.setData('application/x-block-drag', 'true');

            if (currentBlockDom) {
              currentBlockDom.style.opacity = '0.4';
              const ghost = currentBlockDom.cloneNode(true) as HTMLElement;
              ghost.style.position = 'absolute';
              ghost.style.top = '-9999px';
              ghost.style.left = '-9999px';
              ghost.style.opacity = '0.85';
              ghost.style.width = `${currentBlockDom.offsetWidth}px`;
              ghost.style.background = 'white';
              ghost.style.borderRadius = '8px';
              ghost.style.padding = '6px 10px';
              ghost.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
              ghost.style.transform = 'rotate(1deg)';
              document.body.appendChild(ghost);
              e.dataTransfer!.setDragImage(ghost, 0, 0);
              setTimeout(() => ghost.remove(), 50);
            }

            setTimeout(() => {
              if (handleEl) handleEl.style.display = 'none';
            }, 0);
          });

          handleEl.addEventListener('dragend', () => {
            resetDragState();
            currentBlockDom = null;
            currentBlockPos = null;
          });

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
            }, 150);
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
