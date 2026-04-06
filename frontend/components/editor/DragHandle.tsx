'use client';

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Fragment, Slice } from '@tiptap/pm/model';
import { Node as PMNode } from '@tiptap/pm/model';

export const DragHandle = Extension.create({
  name: 'dragHandle',

  addProseMirrorPlugins() {
    let isDragging = false;
    // Track dragged block by index in the top-level children array (stable across transactions)
    let dragNodeIndex = -1;
    let currentBlockIndex = -1;
    let currentBlockDom: HTMLElement | null = null;
    let handleEl: HTMLDivElement | null = null;
    let dropLineEl: HTMLDivElement | null = null;
    let scrollEl: HTMLElement | null = null;

    // Drop gap stored on the indicator element for the drop handler to read
    type DropGap = { targetIdx: number; after: boolean; targetPos: number; lineY: number };

    const findScrollParent = (el: HTMLElement | null): HTMLElement => {
      while (el) {
        const overflow = getComputedStyle(el).overflowY;
        if (overflow === 'auto' || overflow === 'scroll') return el;
        el = el.parentElement;
      }
      return document.documentElement;
    };

    // Collect all top-level blocks with their DOM refs and positions
    const getTopLevelBlocks = (view: any) => {
      const blocks: { pos: number; dom: HTMLElement; size: number }[] = [];
      view.state.doc.forEach((node: PMNode, offset: number) => {
        try {
          const dom = view.nodeDOM(offset) as HTMLElement;
          if (dom && dom.getBoundingClientRect) {
            blocks.push({ pos: offset, dom, size: node.nodeSize });
          }
        } catch { /* skip */ }
      });
      return blocks;
    };

    // Find which inter-block gap is nearest to clientY (edge-based, not center-based)
    const findDropGap = (view: any, clientY: number): DropGap | null => {
      const blocks = getTopLevelBlocks(view);
      if (blocks.length === 0) return null;

      let best: { targetIdx: number; after: boolean; lineY: number; dist: number } | null = null;

      blocks.forEach((block, i) => {
        const rect = block.dom.getBoundingClientRect();

        // Gap BEFORE block i (its top edge)
        const dTop = Math.abs(clientY - rect.top);
        if (!best || dTop < best.dist) {
          best = { targetIdx: i, after: false, lineY: rect.top, dist: dTop };
        }

        // Gap AFTER block i (its bottom edge)
        const dBottom = Math.abs(clientY - rect.bottom);
        if (!best || dBottom < best.dist) {
          best = { targetIdx: i, after: true, lineY: rect.bottom, dist: dBottom };
        }
      });

      if (!best) return null;
      return {
        targetIdx: best.targetIdx,
        after: best.after,
        targetPos: blocks[best.targetIdx].pos,
        lineY: best.lineY,
      };
    };

    const showDropLine = (view: any, clientY: number) => {
      if (!dropLineEl || !scrollEl) return;
      const gap = findDropGap(view, clientY);
      if (!gap) { hideDropLine(); return; }

      const scrollRect = scrollEl.getBoundingClientRect();
      const editorRect = view.dom.getBoundingClientRect();
      // lineY is viewport-relative; convert to scroll-container-relative document coords
      const lineY = gap.lineY - scrollRect.top + scrollEl.scrollTop;

      dropLineEl.style.display = 'block';
      dropLineEl.style.top = `${lineY}px`;
      dropLineEl.style.left = `${editorRect.left - scrollRect.left}px`;
      dropLineEl.style.width = `${editorRect.width}px`;
      (dropLineEl as any)._gap = gap;
    };

    const hideDropLine = () => {
      if (dropLineEl) {
        dropLineEl.style.display = 'none';
        (dropLineEl as any)._gap = null;
      }
    };

    const resetDragState = (view?: any) => {
      isDragging = false;
      dragNodeIndex = -1;
      hideDropLine();
      if (currentBlockDom) currentBlockDom.style.opacity = '';
      if (view?.dom) view.dom.removeAttribute('data-dragging');
    };

    return [
      new Plugin({
        key: new PluginKey('dragHandle'),
        view(editorView) {
          scrollEl = findScrollParent(editorView.dom);

          // ── Drag handle dot ────────────────────────────────────────────
          handleEl = document.createElement('div');
          handleEl.className = 'block-drag-handle';
          handleEl.draggable = true;
          handleEl.contentEditable = 'false';
          handleEl.innerHTML = `<svg width="14" height="20" viewBox="0 0 14 20" fill="currentColor">
            <circle cx="4" cy="3" r="1.6"/><circle cx="10" cy="3" r="1.6"/>
            <circle cx="4" cy="10" r="1.6"/><circle cx="10" cy="10" r="1.6"/>
            <circle cx="4" cy="17" r="1.6"/><circle cx="10" cy="17" r="1.6"/>
          </svg>`;
          handleEl.style.display = 'none';

          // ── Drop indicator line ─────────────────────────────────────────
          dropLineEl = document.createElement('div');
          dropLineEl.className = 'block-drop-indicator';
          dropLineEl.style.display = 'none';

          if (scrollEl) {
            const pos = getComputedStyle(scrollEl).position;
            if (pos === 'static') scrollEl.style.position = 'relative';
            scrollEl.appendChild(handleEl);
            scrollEl.appendChild(dropLineEl);
          }

          // ── Position handle beside hovered block ────────────────────────
          const positionHandle = (blockEl: HTMLElement) => {
            if (!scrollEl || !handleEl) return;
            const scrollRect = scrollEl.getBoundingClientRect();
            const editorRect = editorView.dom.getBoundingClientRect();
            const blockRect = blockEl.getBoundingClientRect();
            const top = blockRect.top - scrollRect.top + scrollEl.scrollTop;
            const left = editorRect.left - scrollRect.left - 36;
            handleEl.style.display = 'flex';
            handleEl.style.top = `${top}px`;
            handleEl.style.left = `${Math.max(4, left)}px`;
          };

          // ── Handle drag events ──────────────────────────────────────────
          handleEl.addEventListener('mousedown', () => {
            dragNodeIndex = currentBlockIndex;
          });

          handleEl.addEventListener('dragstart', (e) => {
            if (dragNodeIndex < 0) { e.preventDefault(); return; }
            isDragging = true;
            editorView.dom.setAttribute('data-dragging', 'true');
            e.dataTransfer!.effectAllowed = 'move';
            e.dataTransfer!.setData('text/plain', '');

            if (currentBlockDom) {
              currentBlockDom.style.opacity = '0.35';
              const ghost = currentBlockDom.cloneNode(true) as HTMLElement;
              ghost.style.cssText = [
                'position:absolute', 'top:-9999px', 'left:-9999px',
                'opacity:0.9', 'background:white', 'border-radius:8px',
                'padding:8px 12px', 'box-shadow:0 4px 16px rgba(0,0,0,0.15)',
              ].join(';');
              ghost.style.width = `${currentBlockDom.offsetWidth}px`;
              document.body.appendChild(ghost);
              e.dataTransfer!.setDragImage(ghost, 24, 16);
              setTimeout(() => ghost.remove(), 50);
            }

            setTimeout(() => { if (handleEl) handleEl.style.display = 'none'; }, 0);
          });

          handleEl.addEventListener('dragend', () => {
            resetDragState(editorView);
            currentBlockDom = null;
            currentBlockIndex = -1;
          });

          // ── scrollEl capture listeners (fire before ProseMirror) ────────
          const onDragOver = (e: DragEvent) => {
            if (!isDragging) return;
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer!.dropEffect = 'move';
            showDropLine(editorView, e.clientY);
          };

          const onDrop = (e: DragEvent) => {
            if (!isDragging) return;
            e.preventDefault();
            e.stopPropagation();

            const gap: DropGap | null = (dropLineEl as any)?._gap ?? null;
            if (!gap) { resetDragState(editorView); return; }

            try {
              const { state } = editorView;

              // Snapshot current top-level blocks
              const blocks: { pos: number; size: number }[] = [];
              state.doc.forEach((node: PMNode, offset: number) => {
                blocks.push({ pos: offset, size: node.nodeSize });
              });

              if (dragNodeIndex < 0 || dragNodeIndex >= blocks.length) {
                resetDragState(editorView); return;
              }

              // Build new order: remove dragged block, then insert at target gap
              const newOrder = [...blocks];
              const [dragged] = newOrder.splice(dragNodeIndex, 1);

              // After splice, find target in the updated list
              let insertAt = newOrder.findIndex(b => b.pos === gap.targetPos);
              if (insertAt < 0) { resetDragState(editorView); return; }
              if (gap.after) insertAt += 1;

              newOrder.splice(insertAt, 0, dragged);

              // Skip if order didn't actually change
              const changed = newOrder.some((b, i) => b.pos !== blocks[i].pos);
              if (!changed) { resetDragState(editorView); return; }

              // Collect actual ProseMirror nodes in the new order
              const newNodes: PMNode[] = newOrder.map(b => state.doc.nodeAt(b.pos)!);
              if (newNodes.some(n => !n)) { resetDragState(editorView); return; }

              // Replace the entire document content in one step
              let frag = Fragment.empty;
              for (const n of newNodes) frag = frag.append(Fragment.from(n));

              const tr = state.tr.replace(0, state.doc.content.size, new Slice(frag, 0, 0));
              editorView.dispatch(tr);
            } catch (err) {
              console.error('[DragHandle] drop failed:', err);
            }

            resetDragState(editorView);
          };

          const onDragLeave = (e: DragEvent) => {
            if (!isDragging) return;
            const related = e.relatedTarget as HTMLElement;
            if (related && scrollEl && scrollEl.contains(related)) return;
            hideDropLine();
          };

          if (scrollEl) {
            scrollEl.addEventListener('dragover', onDragOver, true);
            scrollEl.addEventListener('drop', onDrop, true);
            scrollEl.addEventListener('dragleave', onDragLeave, true);
          }

          // ── Mouse move: track hovered block for handle position ─────────
          const onMouseMove = (e: MouseEvent) => {
            if (isDragging) return;
            const target = e.target as HTMLElement;
            if (handleEl && handleEl.contains(target)) return;

            // Walk up to find first-level child of editorView.dom
            let blockEl: HTMLElement | null = null;
            let el: HTMLElement | null = target;
            while (el && el !== editorView.dom) {
              if (el.parentElement === editorView.dom) { blockEl = el; break; }
              el = el.parentElement;
            }

            if (blockEl && blockEl !== currentBlockDom) {
              currentBlockDom = blockEl;
              // Find its index by matching against nodeDOM for each top-level position
              const idx = getTopLevelBlocks(editorView).findIndex(b => b.dom === blockEl);
              currentBlockIndex = idx;
              if (idx >= 0) {
                positionHandle(blockEl);
              } else {
                if (handleEl) handleEl.style.display = 'none';
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
                currentBlockIndex = -1;
              }
            }, 200);
          };

          editorView.dom.addEventListener('mousemove', onMouseMove);
          editorView.dom.addEventListener('mouseleave', onMouseLeave);

          handleEl.addEventListener('mouseleave', (e) => {
            if (isDragging) return;
            const related = e.relatedTarget as HTMLElement;
            if (related && editorView.dom.contains(related)) return;
            setTimeout(() => {
              if (handleEl && !handleEl.matches(':hover') && !isDragging) {
                handleEl.style.display = 'none';
                currentBlockDom = null;
                currentBlockIndex = -1;
              }
            }, 200);
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
              if (scrollEl) {
                scrollEl.removeEventListener('dragover', onDragOver, true);
                scrollEl.removeEventListener('drop', onDrop, true);
                scrollEl.removeEventListener('dragleave', onDragLeave, true);
              }
            },
          };
        },
      }),
    ];
  },
});
