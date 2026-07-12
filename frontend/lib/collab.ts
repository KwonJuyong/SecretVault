import * as Y from 'yjs';
import { encrypt, decrypt } from './crypto';

/**
 * Encrypted Yjs sync.
 *
 * Yjs gives us convergence: two people editing the same paragraph merge instead of one
 * silently overwriting the other, which is what the old full-document PUT did.
 *
 * The catch is that Yjs updates are structured data — they describe *what changed where*
 * — so relaying them in the clear would hand the server exactly the plaintext the whole
 * E2E design exists to withhold. So every update, and every persisted snapshot, is
 * encrypted with the page key before it leaves the browser. The server relays and stores
 * opaque blobs and can merge nothing itself.
 */

/** Yjs updates are binary; the transport and the DB column are both text. */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Encrypt a Yjs update (or full snapshot) for transport/storage. */
export async function sealUpdate(update: Uint8Array, pageKey: CryptoKey): Promise<string> {
  return encrypt(bytesToBase64(update), pageKey);
}

/** Reverse of sealUpdate. Throws (via decrypt) if the blob will not open. */
export async function openUpdate(sealed: string, pageKey: CryptoKey): Promise<Uint8Array> {
  return base64ToBytes(await decrypt(sealed, pageKey));
}

/** The whole document as one encrypted blob — what gets persisted to pages.content. */
export async function snapshotDoc(doc: Y.Doc, pageKey: CryptoKey): Promise<string> {
  return sealUpdate(Y.encodeStateAsUpdate(doc), pageKey);
}

/** Rebuild a document from a persisted snapshot. */
export async function applySnapshot(doc: Y.Doc, sealed: string, pageKey: CryptoKey): Promise<void> {
  if (!sealed) return;
  Y.applyUpdate(doc, await openUpdate(sealed, pageKey), 'remote');
}

/**
 * Seed a Yjs document from the HTML a pre-CRDT page was stored as.
 *
 * Pages written before this existed hold HTML in `content`. Rather than dropping them,
 * the caller hands the HTML to Tiptap once and we snapshot the result; from then on the
 * page lives as a Yjs document.
 */
export function isYjsContent(content: string, encryptionVersion: number): boolean {
  return encryptionVersion >= 4 && content.length > 0;
}

export type CollabMessage =
  | { type: 'yjs_update'; page_id: string; update: string }
  | { type: 'yjs_sync_request'; page_id: string }
  | { type: 'yjs_sync_response'; page_id: string; update: string };

/**
 * Wires a Y.Doc to a WebSocket, encrypting everything on the way out and decrypting on
 * the way in. Returns a disposer.
 *
 * `origin` tagging matters: updates we apply from the network are tagged 'remote' so the
 * observer does not bounce them straight back out and start an echo.
 */
export function connectDoc(opts: {
  doc: Y.Doc;
  pageId: string;
  pageKey: CryptoKey;
  socket: WebSocket;
  send: (msg: CollabMessage) => void;
  onRemoteChange?: () => void;
}): () => void {
  const { doc, pageId, pageKey, socket, send, onRemoteChange } = opts;

  const onLocalUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === 'remote') return;
    sealUpdate(update, pageKey)
      .then(sealed => send({ type: 'yjs_update', page_id: pageId, update: sealed }))
      .catch(e => console.error('Failed to seal update:', e));
  };
  doc.on('update', onLocalUpdate);

  const onMessage = async (event: MessageEvent) => {
    let msg: CollabMessage;
    try {
      msg = JSON.parse(event.data);
    } catch { return; }
    if (!('page_id' in msg) || msg.page_id !== pageId) return;

    try {
      if (msg.type === 'yjs_update' || msg.type === 'yjs_sync_response') {
        Y.applyUpdate(doc, await openUpdate(msg.update, pageKey), 'remote');
        onRemoteChange?.();
      } else if (msg.type === 'yjs_sync_request') {
        // Somebody just opened this page. Hand them our state so they catch up even if
        // the server holds an older snapshot than what is live in this session.
        send({
          type: 'yjs_sync_response',
          page_id: pageId,
          update: await snapshotDoc(doc, pageKey),
        });
      }
    } catch (e) {
      // A blob we cannot open is not fatal — it just means we hold the wrong key for it.
      console.error('Failed to apply remote update:', e);
    }
  };
  socket.addEventListener('message', onMessage);

  // Ask whoever else has this page open to bring us up to date.
  send({ type: 'yjs_sync_request', page_id: pageId });

  return () => {
    doc.off('update', onLocalUpdate);
    socket.removeEventListener('message', onMessage);
  };
}
