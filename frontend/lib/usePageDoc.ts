'use client';

import { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { connectDoc, snapshotDoc, applySnapshot, type CollabMessage } from './collab';

interface Options {
  pageId: string | null;
  pageKey: CryptoKey | null;
  /** The page's persisted Yjs snapshot (ciphertext), or '' for a page with no history. */
  sealedSnapshot: string;
  /** Pre-CRDT pages hold HTML here instead; seeded into the doc once, then snapshotted. */
  legacyHtml: string | null;
  socket: WebSocket | null;
  send: (msg: CollabMessage) => void;
  /** Persist the whole document. Debounced by this hook; still cheap for normal docs. */
  onPersist: (sealed: string) => Promise<void>;
}

interface Result {
  doc: Y.Doc | null;
  /** True once the snapshot has been loaded — the editor must not mount before this. */
  ready: boolean;
  /** HTML the editor should seed itself from, for a page migrating off the old format. */
  seedHtml: string | null;
}

const PERSIST_DEBOUNCE_MS = 1500;

/**
 * Owns the Y.Doc for the open page.
 *
 * Persistence is still a whole-document snapshot rather than an append-only update log.
 * That is fine precisely *because* it is a CRDT: a snapshot is a merge of everything the
 * doc has seen, so a late write cannot erase an edit it never saw — it would have merged
 * it first. The old code had no such guarantee, which is why it lost data.
 */
export function usePageDoc({
  pageId, pageKey, sealedSnapshot, legacyHtml, socket, send, onPersist,
}: Options): Result {
  const [doc, setDoc] = useState<Y.Doc | null>(null);
  const [ready, setReady] = useState(false);
  const [seedHtml, setSeedHtml] = useState<string | null>(null);
  const persistTimer = useRef<NodeJS.Timeout | null>(null);
  const onPersistRef = useRef(onPersist);

  useEffect(() => { onPersistRef.current = onPersist; }, [onPersist]);

  // Build the doc for this page.
  useEffect(() => {
    if (!pageId || !pageKey) { setDoc(null); setReady(false); return; }

    let cancelled = false;
    const next = new Y.Doc();

    (async () => {
      try {
        if (sealedSnapshot) {
          await applySnapshot(next, sealedSnapshot, pageKey);
        }
      } catch (e) {
        // We hold the key but the snapshot will not open. Do NOT fall through to an empty
        // doc: the caller would then persist that emptiness over the real content.
        console.error('Failed to load page snapshot:', e);
        if (!cancelled) { setDoc(null); setReady(false); }
        return;
      }
      if (cancelled) return;
      setDoc(next);
      setSeedHtml(!sealedSnapshot && legacyHtml ? legacyHtml : null);
      setReady(true);
    })();

    return () => {
      cancelled = true;
      // Deliberately not doc.destroy(): React runs this cleanup before the sync effect's,
      // which still has to take a final snapshot of this document to flush a pending save.
      // A Y.Doc holds no external resources, so letting it be collected is enough.
      setReady(false);
    };
    // sealedSnapshot/legacyHtml are the page's loaded state; they change with pageId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId, pageKey]);

  // Relay updates over the socket, and persist the merged result.
  useEffect(() => {
    if (!doc || !pageId || !pageKey) return;

    let dirty = false;

    const persistNow = async () => {
      dirty = false;
      try {
        await onPersistRef.current(await snapshotDoc(doc, pageKey));
      } catch (e) {
        console.error('Failed to persist page:', e);
      }
    };

    const schedulePersist = () => {
      dirty = true;
      if (persistTimer.current) clearTimeout(persistTimer.current);
      persistTimer.current = setTimeout(persistNow, PERSIST_DEBOUNCE_MS);
    };

    const onAnyUpdate = () => schedulePersist();
    doc.on('update', onAnyUpdate);

    const disconnect = socket && socket.readyState === WebSocket.OPEN
      ? connectDoc({ doc, pageId, pageKey, socket, send })
      : undefined;

    return () => {
      doc.off('update', onAnyUpdate);
      disconnect?.();
      if (persistTimer.current) {
        clearTimeout(persistTimer.current);
        persistTimer.current = null;
      }
      // Flush rather than drop. Navigating to a subpage the moment it is inserted used to
      // unmount this hook mid-debounce, which would have thrown away the edit that created
      // the link. The snapshot is taken from the doc before it is destroyed.
      if (dirty) void persistNow();
    };
  }, [doc, pageId, pageKey, socket, send]);

  return { doc, ready, seedHtml };
}
