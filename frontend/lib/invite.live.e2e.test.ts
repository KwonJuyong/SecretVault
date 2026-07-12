/**
 * Live invite-link flow: someone with no account joins a workspace and reads its pages.
 *
 *   LIVE_API=http://127.0.0.1:3000/api npx vitest run lib/invite.live.e2e.test.ts
 */
import { describe, it, expect } from 'vitest';
import {
  deriveKeys, derivePasswordKey, generateSalt, generateKeyPair,
  exportPublicKey, encryptPrivateKey, decryptPrivateKey,
  generateWorkspaceKey, wrapWorkspaceKeyForUser, unwrapWorkspaceKeyForUser,
  generatePageKey, wrapPageKeyForWorkspace, unwrapPageKeyFromWorkspace,
  encrypt, decrypt,
} from './crypto';
import {
  createInviteSecret, deriveInviteKeys,
  wrapWorkspaceKeyForInvite, unwrapWorkspaceKeyFromInvite,
  buildInviteLink, parseInviteFragment,
} from './invite';
import { sha256Hex } from './hash';

const API = process.env.LIVE_API;
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

async function signUpAndIn(email: string) {
  const password = 'pw';
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

  const d = await call<{
    access_token: string; workspace_id: string;
    encrypted_private_key: string; private_key_iv: string; private_key_salt: string;
  }>('/login', { method: 'POST', body: JSON.stringify({ email, password_hash: authHash }) });

  const s2 = Uint8Array.from(atob(d.private_key_salt), c => c.charCodeAt(0));
  const privateKey = await decryptPrivateKey(
    d.encrypted_private_key, d.private_key_iv, await derivePasswordKey(password, s2),
  );
  return { token: d.access_token, workspaceId: d.workspace_id, privateKey, publicKey: kp.publicKey };
}

async function myWorkspaceKey(token: string, workspaceId: string, privateKey: CryptoKey) {
  const { encrypted_workspace_key } = await call<{ encrypted_workspace_key: string }>(
    `/workspaces/${workspaceId}/key`, {}, token,
  );
  return unwrapWorkspaceKeyForUser(encrypted_workspace_key, privateKey);
}

suite('live: invite link for someone with no account', () => {
  it('carries a stranger all the way to reading the workspace', async () => {
    const stamp = Date.now();

    // --- Alice has a workspace with a page in it ------------------------------
    const alice = await signUpAndIn(`inv-a${stamp}@x.com`);
    const aWsKey = await myWorkspaceKey(alice.token, alice.workspaceId, alice.privateKey);

    const pageKey = await generatePageKey();
    const secretText = '이사회 안건 — 대외비';
    const page = await call<{ id: string }>(`/workspaces/${alice.workspaceId}/pages`, {
      method: 'POST',
      body: JSON.stringify({
        title: await encrypt('안건', pageKey),
        content: await encrypt(secretText, pageKey),
        encryption_version: 4,
        encrypted_page_key: await wrapPageKeyForWorkspace(pageKey, aWsKey),
      }),
    }, alice.token);

    // --- Alice mints an invite link. The secret never leaves her browser -------
    const linkSecret = createInviteSecret();
    const { authToken, wrapKey } = await deriveInviteKeys(linkSecret);
    const created = await call<{ id: string }>(`/workspaces/${alice.workspaceId}/invites`, {
      method: 'POST',
      body: JSON.stringify({
        auth_token_hash: await sha256Hex(authToken),
        encrypted_workspace_key: await wrapWorkspaceKeyForInvite(aWsKey, wrapKey),
        role: 'member',
        expires_in_days: 7,
      }),
    }, alice.token);
    const link = buildInviteLink('https://vault.test', created.id, linkSecret);

    // --- Bob, who has no account, opens the link ------------------------------
    const parsed = parseInviteFragment(new URL(link).hash)!;
    const bobKeys = await deriveInviteKeys(parsed.secret);

    // He can preview it without being logged in at all.
    const preview = await call<{ workspace_name: string; encrypted_workspace_key: string }>(
      `/invites/${parsed.inviteId}?auth_token=${encodeURIComponent(bobKeys.authToken)}`,
    );
    expect(preview.workspace_name).toBeTruthy();

    // He signs up, opens the workspace key with the link secret, re-wraps it for himself.
    const bob = await signUpAndIn(`inv-b${stamp}@x.com`);
    const wsKeyFromLink = await unwrapWorkspaceKeyFromInvite(preview.encrypted_workspace_key, bobKeys.wrapKey);
    await call(`/invites/${parsed.inviteId}/accept`, {
      method: 'POST',
      body: JSON.stringify({
        auth_token: bobKeys.authToken,
        encrypted_workspace_key: await wrapWorkspaceKeyForUser(wsKeyFromLink, bob.publicKey),
      }),
    }, bob.token);

    // --- Bob reads Alice's page, using only his own account's keys ------------
    const bWsKey = await myWorkspaceKey(bob.token, alice.workspaceId, bob.privateKey);
    const fetched = await call<{ content: string; encrypted_page_key: string }>(
      `/workspaces/${alice.workspaceId}/pages/${page.id}`, {}, bob.token,
    );
    const bPageKey = await unwrapPageKeyFromWorkspace(fetched.encrypted_page_key, bWsKey);
    expect(await decrypt(fetched.content, bPageKey)).toBe(secretText);
  }, 40_000);

  it('refuses a link whose secret has been tampered with', async () => {
    const stamp = Date.now() + 5;
    const alice = await signUpAndIn(`inv-t${stamp}@x.com`);
    const aWsKey = await myWorkspaceKey(alice.token, alice.workspaceId, alice.privateKey);

    const real = await deriveInviteKeys(createInviteSecret());
    const created = await call<{ id: string }>(`/workspaces/${alice.workspaceId}/invites`, {
      method: 'POST',
      body: JSON.stringify({
        auth_token_hash: await sha256Hex(real.authToken),
        encrypted_workspace_key: await wrapWorkspaceKeyForInvite(aWsKey, real.wrapKey),
        role: 'member',
        expires_in_days: 7,
      }),
    }, alice.token);

    // Someone who has the invite id but not the secret gets nothing back.
    const forged = await deriveInviteKeys(createInviteSecret());
    await expect(
      call(`/invites/${created.id}?auth_token=${encodeURIComponent(forged.authToken)}`),
    ).rejects.toThrow(/404/);
  }, 40_000);

  it('burns the link after one use', async () => {
    const stamp = Date.now() + 9;
    const alice = await signUpAndIn(`inv-o${stamp}@x.com`);
    const aWsKey = await myWorkspaceKey(alice.token, alice.workspaceId, alice.privateKey);

    const keys = await deriveInviteKeys(createInviteSecret());
    const created = await call<{ id: string }>(`/workspaces/${alice.workspaceId}/invites`, {
      method: 'POST',
      body: JSON.stringify({
        auth_token_hash: await sha256Hex(keys.authToken),
        encrypted_workspace_key: await wrapWorkspaceKeyForInvite(aWsKey, keys.wrapKey),
        role: 'member',
        expires_in_days: 7,
      }),
    }, alice.token);

    const bob = await signUpAndIn(`inv-o1${stamp}@x.com`);
    await call(`/invites/${created.id}/accept`, {
      method: 'POST',
      body: JSON.stringify({ auth_token: keys.authToken, encrypted_workspace_key: 'for-bob' }),
    }, bob.token);

    // Carol got forwarded the same link. It is spent.
    const carol = await signUpAndIn(`inv-o2${stamp}@x.com`);
    await expect(
      call(`/invites/${created.id}/accept`, {
        method: 'POST',
        body: JSON.stringify({ auth_token: keys.authToken, encrypted_workspace_key: 'for-carol' }),
      }, carol.token),
    ).rejects.toThrow(/410/);
  }, 40_000);
});
