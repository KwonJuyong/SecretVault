/**
 * Live collaborative-editing check: two clients, one real WebSocket relay, one server.
 *
 * This is the claim being tested — that two people typing in the same page at the same
 * time now merge instead of one silently overwriting the other — exercised against the
 * actual backend rather than in-process.
 *
 *   LIVE_API=http://127.0.0.1:3000/api npx vitest run lib/collab.live.e2e.test.ts
 */
import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import {
  deriveKeys, derivePasswordKey, generateSalt, generateKeyPair,
  exportPublicKey, importPublicKey, encryptPrivateKey, decryptPrivateKey,
  generateWorkspaceKey, wrapWorkspaceKeyForUser, unwrapWorkspaceKeyForUser,
  generatePageKey, wrapPageKeyForWorkspace, unwrapPageKeyFromWorkspace,
  encrypt,
} from './crypto';
import { connectDoc, snapshotDoc, applySnapshot, type CollabMessage } from './collab';

const API = process.env.LIVE_API;
const WS_BASE = API?.replace(/^http/, 'ws');
const suite = API ? describe : describe.skip;

async function call<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} -> ${res.status}: ${text}`);
  return (text ? JSON.parse(text) : undefined) as T;
}

async function signUpAndIn(email: string, password: string) {
  const { authHash } = deriveKeys(password);
  const kp = await generateKeyPair();
  const salt = generateSalt();
  const pk = await derivePasswordKey(password, salt);
  const { encrypted, iv } = await encryptPrivateKey(kp.privateKey, pk);
  const wsKey = await generateWorkspaceKey();

  await call('/signup', {
    method: 'POST',
    body: JSON.stringify({
      email, password_hash: authHash, username: email,
      public_key: await exportPublicKey(kp.publicKey),
      encrypted_private_key: encrypted, private_key_iv: iv,
      private_key_salt: btoa(String.fromCharCode(...salt)),
      encrypted_workspace_key: await wrapWorkspaceKeyForUser(wsKey, kp.publicKey),
    }),
  });

  const data = await call<{
    access_token: string; workspace_id: string; public_key: string;
    encrypted_private_key: string; private_key_iv: string; private_key_salt: string;
  }>('/login', { method: 'POST', body: JSON.stringify({ email, password_hash: authHash }) });

  const s2 = Uint8Array.from(atob(data.private_key_salt), c => c.charCodeAt(0));
  const privateKey = await decryptPrivateKey(
    data.encrypted_private_key, data.private_key_iv, await derivePasswordKey(password, s2),
  );
  return { token: data.access_token, workspaceId: data.workspace_id, privateKey };
}

async function workspaceKeyOf(token: string, workspaceId: string, privateKey: CryptoKey) {
  const { encrypted_workspace_key } = await call<{ encrypted_workspace_key: string }>(
    `/workspaces/${workspaceId}/key`, {}, token,
  );
  return unwrapWorkspaceKeyForUser(encrypted_workspace_key, privateKey);
}

/** Open the workspace socket, exactly as the app does. */
function openSocket(workspaceId: string, token: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${WS_BASE}/ws/${workspaceId}?token=${token}`);
    ws.onopen = () => resolve(ws);
    ws.onerror = () => reject(new Error('socket failed to open'));
    setTimeout(() => reject(new Error('socket open timed out')), 8000);
  });
}

const settle = (ms = 700) => new Promise(r => setTimeout(r, ms));

suite('live: two people editing the same page at once', () => {
  it('merges concurrent edits through the real server instead of losing one', async () => {
    const stamp = Date.now();
    const alice = await signUpAndIn(`ca${stamp}@x.com`, 'pw-a');
    const aWsKey = await workspaceKeyOf(alice.token, alice.workspaceId, alice.privateKey);

    // Bob joins Alice's workspace.
    const bobEmail = `cb${stamp}@x.com`;
    const bob = await signUpAndIn(bobEmail, 'pw-b');
    const { public_key } = await call<{ public_key: string }>(
      `/users/${encodeURIComponent(bobEmail)}/public-key`, {}, alice.token,
    );
    await call(`/workspaces/${alice.workspaceId}/members`, {
      method: 'POST',
      body: JSON.stringify({
        email: bobEmail, role: 'member',
        encrypted_workspace_key: await wrapWorkspaceKeyForUser(aWsKey, await importPublicKey(public_key)),
      }),
    }, alice.token);
    const bWsKey = await workspaceKeyOf(bob.token, alice.workspaceId, bob.privateKey);

    // Alice creates the page with an initial Yjs body.
    const pageKey = await generatePageKey();
    const seed = new Y.Doc();
    seed.getText('body').insert(0, 'Shared agenda: ');
    const page = await call<{ id: string }>(`/workspaces/${alice.workspaceId}/pages`, {
      method: 'POST',
      body: JSON.stringify({
        title: await encrypt('회의', pageKey),
        content: await snapshotDoc(seed, pageKey),
        encryption_version: 4,
        encrypted_page_key: await wrapPageKeyForWorkspace(pageKey, aWsKey),
      }),
    }, alice.token);

    // Both open the page. Each unwraps the page key its own way and loads the snapshot.
    const aKey = await unwrapPageKeyFromWorkspace(
      (await call<{ encrypted_page_key: string }>(
        `/workspaces/${alice.workspaceId}/pages/${page.id}`, {}, alice.token)).encrypted_page_key,
      aWsKey,
    );
    const bKey = await unwrapPageKeyFromWorkspace(
      (await call<{ encrypted_page_key: string; content: string }>(
        `/workspaces/${alice.workspaceId}/pages/${page.id}`, {}, bob.token)).encrypted_page_key,
      bWsKey,
    );
    const stored = await call<{ content: string }>(
      `/workspaces/${alice.workspaceId}/pages/${page.id}`, {}, bob.token,
    );

    const aDoc = new Y.Doc();
    const bDoc = new Y.Doc();
    await applySnapshot(aDoc, stored.content, aKey);
    await applySnapshot(bDoc, stored.content, bKey);

    const aSock = await openSocket(alice.workspaceId, alice.token);
    const bSock = await openSocket(alice.workspaceId, bob.token);

    const send = (sock: WebSocket) => (msg: CollabMessage) => sock.send(JSON.stringify(msg));
    const stopA = connectDoc({ doc: aDoc, pageId: page.id, pageKey: aKey, socket: aSock, send: send(aSock) });
    const stopB = connectDoc({ doc: bDoc, pageId: page.id, pageKey: bKey, socket: bSock, send: send(bSock) });
    await settle();

    // They type at the same instant, neither having seen the other's edit.
    aDoc.getText('body').insert(aDoc.getText('body').length, '[Alice: budget]');
    bDoc.getText('body').insert(0, '[Bob: intro] ');
    await settle(1200);

    const aText = aDoc.getText('body').toString();
    const bText = bDoc.getText('body').toString();

    expect(aText).toBe(bText);                    // converged across the real relay
    expect(aText).toContain('[Alice: budget]');   // neither edit was lost
    expect(aText).toContain('[Bob: intro]');
    expect(aText).toContain('Shared agenda: ');

    stopA(); stopB(); aSock.close(); bSock.close();
  }, 30_000);

  it('never lets the server see the plaintext it is relaying', async () => {
    const stamp = Date.now() + 7;
    const alice = await signUpAndIn(`cs${stamp}@x.com`, 'pw');
    const aWsKey = await workspaceKeyOf(alice.token, alice.workspaceId, alice.privateKey);

    const pageKey = await generatePageKey();
    const doc = new Y.Doc();
    doc.getText('body').insert(0, 'CLASSIFIED-MARKER-9931');

    const page = await call<{ id: string }>(`/workspaces/${alice.workspaceId}/pages`, {
      method: 'POST',
      body: JSON.stringify({
        title: await encrypt('t', pageKey),
        content: await snapshotDoc(doc, pageKey),
        encryption_version: 4,
        encrypted_page_key: await wrapPageKeyForWorkspace(pageKey, aWsKey),
      }),
    }, alice.token);

    // Read back exactly what the server holds.
    const stored = await call<{ content: string }>(
      `/workspaces/${alice.workspaceId}/pages/${page.id}`, {}, alice.token,
    );
    expect(stored.content).not.toContain('CLASSIFIED-MARKER-9931');
    expect(atob(stored.content)).not.toContain('CLASSIFIED-MARKER-9931');
  }, 30_000);
});
