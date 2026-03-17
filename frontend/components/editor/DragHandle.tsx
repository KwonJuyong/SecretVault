'use client';

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { NodeSelection } from '@tiptap/pm/state';

const dragHandlePluginKey = new PluginKey('dragHandle');

export const DragHandle = Extension.create({
  name: 'dragHandle',

  addProseMirrorPlugins() {
    let dragHandleElement: HTMLDivElement | null = null;
    let currentNode: HTMLElement | null = null;
    const editorView = this.editor.view;

    const createDragHandle = () => {
      const el = document.createElement('div');
      el.className = 'drag-handle';
      el.contentEditable = 'false';
      el.draggable = true;
      el.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
        <circle cx="4" cy="3" r="1.5"/><circle cx="10" cy="3" r="1.5"/>
        <circle cx="4" cy="7" r="1.5"/><circle cx="10" cy="7" r="1.5"/>
        <circle cx="4" cy="11" r="1.5"/><circle cx="10" cy="11" r="1.5"/>
      </svg>`;

      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        if (!currentNode) return;

        const pos = editorView.posAtDOM(currentNode, 0);
        if (pos == null) return;

        const $pos = editorView.state.doc.resolve(pos);
        // Find the top-level node
        const nodePos = $pos.before($pos.depth > 0 ? 1 : 0);
        const node = editorView.state.doc.nodeAt(nodePos);
        if (!node) return;

        // Set node selection
        const tr = editorView.state.tr.setSelection(NodeSelection.create(editorView.state.doc, nodePos));
        editorView.dispatch(tr);
      });

      el.addEventListener('dragstart', (e) => {
        if (!currentNode) return;
        const pos = editorView.posAtDOM(currentNode, 0);
        if (pos == null) return;

        const $pos = editorView.state.doc.resolve(pos);
        const nodePos = $pos.before($pos.depth > 0 ? 1 : 0);
        const node = editorView.state.doc.nodeAt(nodePos);
        if (!node) return;

        const tr = editorView.state.tr.setSelection(NodeSelection.create(editorView.state.doc, nodePos));
        editorView.dispatch(tr);

        e.dataTransfer?.setData('text/plain', currentNode.textContent || '');
      });

      document.body.appendChild(el);
      return el;
    };

    const showHandle = (node: HTMLElement) => {
      if (!dragHandleElement) {
        dragHandleElement = createDragHandle();
      }
      currentNode = node;
      const rect = node.getBoundingClientRect();
      const editorRect = editorView.dom.getBoundingClientRect();

      dragHandleElement.style.display = 'flex';
      dragHandleElement.style.top = `${rect.top + window.scrollY + 2}px`;
      dragHandleElement.style.left = `${editorRect.left - 28}px`;
    };

    const hideHandle = () => {
      if (dragHandleElement) {
        dragHandleElement.style.display = 'none';
      }
      currentNode = null;
    };

    return [
      new Plugin({
        key: dragHandlePluginKey,
        props: {
          handleDOMEvents: {
            mouseover(view, event) {
              const target = event.target as HTMLElement;
              if (!target) return false;

              // Find the closest top-level block node
              const editorDom = view.dom;
              let blockEl = target.closest('.ProseMirror > *') as HTMLElement;
              if (!blockEl) {
                // Check if we're inside the editor
                let el: HTMLElement | null = target;
                while (el && el !== editorDom) {
                  if (el.parentElement === editorDom) {
                    blockEl = el;
                    break;
                  }
                  el = el.parentElement;
                }
              }

              if (blockEl && editorDom.contains(blockEl)) {
                showHandle(blockEl);
              }
              return false;
            },
            mouseleave(view, event) {
              const relatedTarget = event.relatedTarget as HTMLElement;
              if (relatedTarget && dragHandleElement?.contains(relatedTarget)) {
                return false;
              }
              hideHandle();
              return false;
            },
          },
        },
        view() {
          return {
            destroy() {
              if (dragHandleElement) {
                dragHandleElement.remove();
                dragHandleElement = null;
              }
            },
          };
        },
      }),
    ];
  },
});
