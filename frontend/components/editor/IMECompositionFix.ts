import { Extension } from '@tiptap/react';
import { Plugin, PluginKey } from '@tiptap/pm/state';

/**
 * Prevents ProseMirror keymap handlers (Backspace, Enter, etc.) from
 * firing during IME composition. Without this, Korean/CJK input causes
 * duplicate or garbled characters because StarterKit's key handlers
 * interfere with the browser's composition events.
 *
 * Returning true from handleKeyDown tells ProseMirror the event is
 * consumed (no other handlers run). This does NOT break IME because
 * composition is driven by compositionupdate/input events, not keydown.
 */
const IMECompositionFix = Extension.create({
  name: 'imeCompositionFix',

  addProseMirrorPlugins() {
    let composing = false;

    return [
      new Plugin({
        key: new PluginKey('imeCompositionFix'),
        props: {
          handleDOMEvents: {
            compositionstart: () => { composing = true; return false; },
            compositionend: () => { composing = false; return false; },
          },
          handleKeyDown: () => {
            if (composing) return true;
            return false;
          },
        },
      }),
    ];
  },
});

export default IMECompositionFix;
