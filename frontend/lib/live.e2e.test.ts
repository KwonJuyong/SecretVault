/**
 * Live end-to-end check against a running backend.
 *
 * This drives the real HTTP API using the real client-side crypto from ./crypto — the
 * same calls the browser makes — so it exercises the whole workspace-key flow against a
 * real server rather than a mocked one.
 *
 * Skipped unless LIVE_API is set:
 *   backend:  DATABASE_URL=sqlite:///./_devcheck.db uvicorn main:app --port 8000
 *   run:      LIVE_API=http://127.0.0.1:3000/api npx vitest run lib/live.e2e.test.ts
 */
import { describe, it, expect } from 'vitest';
import {
  deriveKeys,
  derivePasswordKey, generateSalt, generateKeyPair,
  exportPublicKey, importPublicKey, encryptPrivateKey, decryptPrivateKey,
  generateWorkspaceKey, wrapWorkspaceKeyForUser, unwrapWorkspaceKeyForUser,
  generatePageKey, wrapPageKeyForWorkspace, unwrapPageKeyFromWorkspace,
  encrypt, decrypt,
} from './crypto';

const API = process.env.LIVE_API;
const suite = API ? describe : describe.skip;

async function call<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} -> ${res.status}: ${text}`);
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Everything a browser holds for one signed-in user. */
async function signUp(email: string, password: string) {
  const { authHash } = deriveKeys(password);
  const keyPair = await generateKeyPair();
  const salt = generateSalt();
  const passwordKey = await derivePasswordKey(password, salt);
  const { encrypted, iv } = await encryptPrivateKey(keyPair.privateKey, passwordKey);

  const workspaceKey = await generateWorkspaceKey();

  await call('/signup', {
    method: 'POST',
    body: JSON.stringify({
      email, password_hash: authHash, username: email,
      public_key: await exportPublicKey(keyPair.publicKey),
      encrypted_private_key: encrypted,
      private_key_iv: iv,
      private_key_salt: btoa(String.fromCharCode(...salt)),
      encrypted_workspace_key: await wrapWorkspaceKeyForUser(workspaceKey, keyPair.publicKey),
    }),
  });
  return { email, password };
}

async function logIn(email: string, password: string) {
  const { authHash } = deriveKeys(password);
  const data = await call<{
    access_token: string; workspace_id: string;
    public_key: string; encrypted_private_key: string;
    private_key_iv: string; private_key_salt: string;
  }>('/login', { method: 'POST', body: JSON.stringify({ email, password_hash: authHash }) });

  const salt = Uint8Array.from(atob(data.private_key_salt), c => c.charCodeAt(0));
  const passwordKey = await derivePasswordKey(password, salt);
  const privateKey = await decryptPrivateKey(data.encrypted_private_key, data.private_key_iv, passwordKey);
  const publicKey = await importPublicKey(data.public_key);

  return { token: data.access_token, workspaceId: data.workspace_id, privateKey, publicKey };
}

/** Fetch and unwrap this user's copy of the workspace key — what AuthContext does on login. */
async function getWorkspaceKey(token: string, workspaceId: string, privateKey: CryptoKey) {
  const { encrypted_workspace_key } = await call<{ encrypted_workspace_key: string }>(
    `/workspaces/${workspaceId}/key`, {}, token,
  );
  return unwrapWorkspaceKeyForUser(encrypted_workspace_key, privateKey);
}

suite('live: the invited-member flow that used to be broken', () => {
  it('lets an invited member read a page the owner wrote before they joined', async () => {
    const stamp = Date.now();
    const alice = `alice${stamp}@x.com`;
    const bob = `bob${stamp}@x.com`;

    // --- Alice signs up and writes a page ---------------------------------
    await signUp(alice, 'alice-password');
    const a = await logIn(alice, 'alice-password');
    const aWsKey = await getWorkspaceKey(a.token, a.workspaceId, a.privateKey);

    const pageKey = await generatePageKey();
    const secret = '2분기 예산 회의록 — 승인됨 🔒';
    const created = await call<{ id: string }>(
      `/workspaces/${a.workspaceId}/pages`,
      {
        method: 'POST',
        body: JSON.stringify({
          title: await encrypt('회의록', pageKey),
          content: await encrypt(secret, pageKey),
          encryption_version: 3,
          encrypted_page_key: await wrapPageKeyForWorkspace(pageKey, aWsKey),
        }),
      },
      a.token,
    );

    // --- Bob signs up, then Alice invites him ------------------------------
    await signUp(bob, 'bob-password');
    const { public_key } = await call<{ public_key: string }>(
      `/users/${encodeURIComponent(bob)}/public-key`, {}, a.token,
    );
    await call(
      `/workspaces/${a.workspaceId}/members`,
      {
        method: 'POST',
        body: JSON.stringify({
          email: bob,
          role: 'member',
          encrypted_workspace_key: await wrapWorkspaceKeyForUser(
            aWsKey, await importPublicKey(public_key),
          ),
        }),
      },
      a.token,
    );

    // --- Bob logs in and opens Alice's page --------------------------------
    const b = await logIn(bob, 'bob-password');
    const bWsKey = await getWorkspaceKey(b.token, a.workspaceId, b.privateKey);

    const page = await call<{ title: string; content: string; encrypted_page_key: string }>(
      `/workspaces/${a.workspaceId}/pages/${created.id}`, {}, b.token,
    );
    const bPageKey = await unwrapPageKeyFromWorkspace(page.encrypted_page_key, bWsKey);

    expect(await decrypt(page.content, bPageKey)).toBe(secret);
    expect(await decrypt(page.title, bPageKey)).toBe('회의록');

    // The sidebar listing must carry the key too, or every title renders as locked.
    const tree = await call<Array<{ id: string; title: string; encrypted_page_key: string }>>(
      `/workspaces/${a.workspaceId}/pages`, {}, b.token,
    );
    const item = tree.find(p => p.id === created.id)!;
    expect(item.encrypted_page_key).toBeTruthy();
    expect(await decrypt(item.title, await unwrapPageKeyFromWorkspace(item.encrypted_page_key, bWsKey)))
      .toBe('회의록');
  });

  it('lets the invited member write, and the owner reads it back', async () => {
    const stamp = Date.now() + 1;
    const alice = `alice${stamp}@x.com`;
    const bob = `bob${stamp}@x.com`;

    await signUp(alice, 'pw-alice');
    const a = await logIn(alice, 'pw-alice');
    const aWsKey = await getWorkspaceKey(a.token, a.workspaceId, a.privateKey);

    await signUp(bob, 'pw-bob');
    const { public_key } = await call<{ public_key: string }>(
      `/users/${encodeURIComponent(bob)}/public-key`, {}, a.token,
    );
    await call(`/workspaces/${a.workspaceId}/members`, {
      method: 'POST',
      body: JSON.stringify({
        email: bob, role: 'member',
        encrypted_workspace_key: await wrapWorkspaceKeyForUser(aWsKey, await importPublicKey(public_key)),
      }),
    }, a.token);

    // Bob creates a page in Alice's workspace.
    const b = await logIn(bob, 'pw-bob');
    const bWsKey = await getWorkspaceKey(b.token, a.workspaceId, b.privateKey);
    const bobKey = await generatePageKey();
    const bobText = 'bob이 작성한 문서';
    const made = await call<{ id: string }>(`/workspaces/${a.workspaceId}/pages`, {
      method: 'POST',
      body: JSON.stringify({
        title: await encrypt('bob 문서', bobKey),
        content: await encrypt(bobText, bobKey),
        encryption_version: 3,
        encrypted_page_key: await wrapPageKeyForWorkspace(bobKey, bWsKey),
      }),
    }, b.token);

    // Alice reads it without anyone re-wrapping anything for her.
    const seen = await call<{ content: string; encrypted_page_key: string }>(
      `/workspaces/${a.workspaceId}/pages/${made.id}`, {}, a.token,
    );
    const asAlice = await unwrapPageKeyFromWorkspace(seen.encrypted_page_key, aWsKey);
    expect(await decrypt(seen.content, asAlice)).toBe(bobText);
  });

  it('refuses an invite that carries no wrapped key', async () => {
    const stamp = Date.now() + 2;
    const alice = `alice${stamp}@x.com`;
    const bob = `bob${stamp}@x.com`;
    await signUp(alice, 'pw');
    await signUp(bob, 'pw');
    const a = await logIn(alice, 'pw');

    await expect(
      call(`/workspaces/${a.workspaceId}/members`, {
        method: 'POST',
        body: JSON.stringify({ email: bob, role: 'member' }),
      }, a.token),
    ).rejects.toThrow(/400/);
  });

  it('keeps an outsider out of the workspace entirely', async () => {
    const stamp = Date.now() + 3;
    const alice = `alice${stamp}@x.com`;
    const mallory = `mallory${stamp}@x.com`;
    await signUp(alice, 'pw');
    await signUp(mallory, 'pw');
    const a = await logIn(alice, 'pw');
    const m = await logIn(mallory, 'pw');

    await expect(
      call(`/workspaces/${a.workspaceId}/key`, {}, m.token),
    ).rejects.toThrow(/403/);
    await expect(
      call(`/workspaces/${a.workspaceId}/pages`, {}, m.token),
    ).rejects.toThrow(/403/);
  });
});
