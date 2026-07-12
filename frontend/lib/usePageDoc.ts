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
  /** Store a history entry. Called sparingly — see the version logic below. */
  onSaveVersion?: (sealed: string) => Promise<void>;
}

interface Result {
  doc: Y.Doc | null;
  /** True once the snapshot has been loaded — the editor must not mount before this. */
  ready: boolean;
  /** HTML the editor should seed itself from, for a page migrating off the old format. */
  seedHtml: string | null;
}

const PERSIST_DEBOUNCE_MS = 1500;

/** While someone keeps editing, drop a further restore point this often. */
const VERSION_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Owns the Y.Doc for the open page.
 *
 * Persistence is still a whole-document snapshot rather than an append-only update log.
 * That is fine precisely *because* it is a CRDT: a snapshot is a merge of everything the
 * doc has seen, so a late write cannot erase an edit it never saw — it would have merged
 * it first. The old code had no such guarantee, which is why it lost data.
 */
export function usePageDoc({
  pageId, pageKey, sealedSnapshot, legacyHtml, socket, send, onPersist, onSaveVersion,
}: Options): Result {
  const [doc, setDoc] = useState<Y.Doc | null>(null);
  const [ready, setReady] = useState(false);
  const [seedHtml, setSeedHtml] = useState<string | null>(null);
  const persistTimer = useRef<NodeJS.Timeout | null>(null);
  const onPersistRef = useRef(onPersist);
  const onSaveVersionRef = useRef(onSaveVersion);

  useEffect(() => { onPersistRef.current = onPersist; }, [onPersist]);
  useEffect(() => { onSaveVersionRef.current = onSaveVersion; }, [onSaveVersion]);

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

    // The state to fall back to. Captured before the first edit of this session, because
    // "put it back the way it was before I started" is the restore people actually want —
    // a snapshot taken *after* the damage is no use.
    const baseline = sealedSnapshot;
    let versionedThisSession = false;
    let lastVersionAt = 0;

    const maybeSaveVersion = (origin: unknown) => {
      // Only our own edits. A remote peer's changes are versioned on their client, and
      // versioning them here too would multiply the same restore point by the number of
      // people who happen to have the page open.
      if (origin === 'remote' || !onSaveVersionRef.current) return;

      const now = Date.now();
      if (!versionedThisSession) {
        versionedThisSession = true;
        lastVersionAt = now;
        if (baseline) void onSaveVersionRef.current(baseline).catch(e =>
          console.error('Failed to save version:', e));
        return;
      }
      if (now - lastVersionAt < VERSION_INTERVAL_MS) return;

      lastVersionAt = now;
      void (async () => {
        try {
          await onSaveVersionRef.current!(await snapshotDoc(doc, pageKey));
        } catch (e) {
          console.error('Failed to save version:', e);
        }
      })();
    };

    const onAnyUpdate = (_update: Uint8Array, origin: unknown) => {
      schedulePersist();
      maybeSaveVersion(origin);
    };
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
    // sealedSnapshot is the baseline for this doc and changes only when pageId does,
    // which already rebuilds the doc above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, pageId, pageKey, socket, send]);

  return { doc, ready, seedHtml };
}
