/**
 * Live check of page management against a running backend: favorites, and the tree
 * reordering the sidebar's drag-and-drop drives through computeDrop().
 *
 *   LIVE_API=http://127.0.0.1:3000/api npx vitest run lib/pagemgmt.live.e2e.test.ts
 */
import { describe, it, expect } from 'vitest';
import {
  deriveKeys, derivePasswordKey, generateSalt, generateKeyPair,
  exportPublicKey, encryptPrivateKey, decryptPrivateKey,
  generateWorkspaceKey, wrapWorkspaceKeyForUser, unwrapWorkspaceKeyForUser,
  generatePageKey, wrapPageKeyForWorkspace, encrypt,
} from './crypto';
import { computeDrop, breadcrumbTrail } from './tree';
import type { PageTreeItem } from './types';

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

async function newUser(email: string) {
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
  const { encrypted_workspace_key } = await call<{ encrypted_workspace_key: string }>(
    `/workspaces/${d.workspace_id}/key`, {}, d.access_token,
  );
  return {
    token: d.access_token,
    workspaceId: d.workspace_id,
    workspaceKey: await unwrapWorkspaceKeyForUser(encrypted_workspace_key, privateKey),
  };
}

async function makePage(u: Awaited<ReturnType<typeof newUser>>, title: string, parentId?: string) {
  const pageKey = await generatePageKey();
  return call<{ id: string }>(`/workspaces/${u.workspaceId}/pages`, {
    method: 'POST',
    body: JSON.stringify({
      title: await encrypt(title, pageKey),
      content: '',
      parent_id: parentId ?? null,
      encryption_version: 4,
      encrypted_page_key: await wrapPageKeyForWorkspace(pageKey, u.workspaceKey),
    }),
  }, u.token);
}

const tree = (u: Awaited<ReturnType<typeof newUser>>) =>
  call<PageTreeItem[]>(`/workspaces/${u.workspaceId}/pages`, {}, u.token);

suite('live: page management', () => {
  it('stars a page and lists it back', async () => {
    const u = await newUser(`fav${Date.now()}@x.com`);
    const p = await makePage(u, 'starred');

    await call(`/workspaces/${u.workspaceId}/pages/${p.id}/favorite`, { method: 'POST' }, u.token);
    let favs = await call<PageTreeItem[]>('/favorites', {}, u.token);
    expect(favs.map(f => f.id)).toEqual([p.id]);

    await call(`/workspaces/${u.workspaceId}/pages/${p.id}/favorite`, { method: 'DELETE' }, u.token);
    favs = await call<PageTreeItem[]>('/favorites', {}, u.token);
    expect(favs).toEqual([]);
  }, 30_000);

  it('drags a page under another and the tree comes back reparented', async () => {
    const u = await newUser(`drag${Date.now()}@x.com`);
    const target = await makePage(u, 'target');
    const dragged = await makePage(u, 'dragged');

    const before = await tree(u);
    const move = computeDrop(before, dragged.id, target.id, 'inside');
    expect(move).not.toBeNull();

    await call(`/workspaces/${u.workspaceId}/pages/${dragged.id}/move`, {
      method: 'POST',
      body: JSON.stringify({ parent_id: move!.parentId, position: move!.position }),
    }, u.token);

    const after = await tree(u);
    const moved = after.find(p => p.id === dragged.id)!;
    expect(moved.parent_id).toBe(target.id);
    expect(breadcrumbTrail(after, dragged.id).map(p => p.id)).toEqual([target.id, dragged.id]);
  }, 30_000);

  it('drags a nested page back out to the top level', async () => {
    const u = await newUser(`root${Date.now()}@x.com`);
    const parent = await makePage(u, 'parent');
    const child = await makePage(u, 'child', parent.id);

    // parent_id: null is the "move to root" signal — an omitted field means "leave it".
    await call(`/workspaces/${u.workspaceId}/pages/${child.id}/move`, {
      method: 'POST',
      body: JSON.stringify({ parent_id: null, position: 99 }),
    }, u.token);

    const after = await tree(u);
    expect(after.find(p => p.id === child.id)!.parent_id).toBeNull();
  }, 30_000);

  it('refuses to drop a page into its own subtree, client and server agree', async () => {
    const u = await newUser(`cycle${Date.now()}@x.com`);
    const parent = await makePage(u, 'parent');
    const child = await makePage(u, 'child', parent.id);

    const pages = await tree(u);
    // The client will not even offer the move…
    expect(computeDrop(pages, parent.id, child.id, 'inside')).toBeNull();

    // …and the server rejects it if asked anyway.
    await expect(
      call(`/workspaces/${u.workspaceId}/pages/${parent.id}/move`, {
        method: 'POST',
        body: JSON.stringify({ parent_id: child.id }),
      }, u.token),
    ).rejects.toThrow(/400/);
  }, 30_000);

  it('keeps fractional ordering when a page is dropped between two siblings', async () => {
    const u = await newUser(`order${Date.now()}@x.com`);
    const a = await makePage(u, 'a');
    await makePage(u, 'b');
    const c = await makePage(u, 'c');

    const pages = await tree(u);
    const move = computeDrop(pages, c.id, a.id, 'after')!; // c goes between a and b

    await call(`/workspaces/${u.workspaceId}/pages/${c.id}/move`, {
      method: 'POST',
      body: JSON.stringify({ parent_id: move.parentId, position: move.position }),
    }, u.token);

    const after = await tree(u); // the API returns pages ordered by position
    expect(after.map(p => p.id).indexOf(c.id)).toBe(1);
  }, 30_000);
});
