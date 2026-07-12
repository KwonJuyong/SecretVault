import * as Y from 'yjs';
import { yXmlFragmentToProsemirrorJSON } from 'y-prosemirror';
import { openUpdate } from './collab';

/**
 * Page history.
 *
 * A version is just an encrypted Yjs snapshot, the same shape as the page's live content.
 *
 * Restoring is the interesting part. The obvious move — swap the live Y.Doc for the old
 * one — is wrong: peers who still hold the current doc would never learn about the swap,
 * and the two would diverge permanently. So a restore is expressed as an ordinary *edit*
 * that makes the content equal the old version. It propagates like any other keystroke,
 * every peer converges on it, and it can itself be undone.
 */

/** The field name Tiptap's Collaboration extension binds the editor to. */
export const COLLAB_FIELD = 'default';

/** Read a version's document content back as ProseMirror JSON. */
export async function versionToProseMirrorJSON(
  sealedSnapshot: string, pageKey: CryptoKey,
): Promise<unknown> {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, await openUpdate(sealedSnapshot, pageKey));
  return yXmlFragmentToProsemirrorJSON(doc.getXmlFragment(COLLAB_FIELD));
}

/** Plain text of a version, for the preview line in the history list. */
export function previewText(json: unknown, limit = 120): string {
  const parts: string[] = [];

  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const n = node as { type?: string; text?: string; content?: unknown[] };
    if (n.type === 'text' && typeof n.text === 'string') parts.push(n.text);
    if (Array.isArray(n.content)) n.content.forEach(walk);
  };
  walk(json);

  const text = parts.join(' ').replace(/\s+/g, ' ').trim();
  return text.length > limit ? text.slice(0, limit) + '…' : text;
}
