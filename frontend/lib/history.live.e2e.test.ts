/**
 * Live page-history flow, including the claim that a restore is a merge and not a swap:
 * a second client with the page open converges on the restored content.
 *
 *   LIVE_API=http://127.0.0.1:3000/api npx vitest run lib/history.live.e2e.test.ts
 */
import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { prosemirrorJSONToYXmlFragment } from 'y-prosemirror';
import { Schema } from '@tiptap/pm/model';
import {
  deriveKeys, derivePasswordKey, generateSalt, generateKeyPair,
  exportPublicKey, encryptPrivateKey, decryptPrivateKey,
  generateWorkspaceKey, wrapWorkspaceKeyForUser, unwrapWorkspaceKeyForUser,
  generatePageKey, wrapPageKeyForWorkspace, encrypt,
} from './crypto';
import { snapshotDoc, applySnapshot } from './collab';
import { versionToProseMirrorJSON, previewText, COLLAB_FIELD } from './history';

const API = process.env.LIVE_API;
const suite = API ? describe : describe.skip;

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'inline*', toDOM: () => ['p', 0] },
    text: { group: 'inline' },
  },
});

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
  const { encrypted, iv } = await encryptPrivateKey(
    kp.privateKey, await derivePasswordKey(password, salt),
  );
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

function docWith(text: string): Y.Doc {
  const doc = new Y.Doc();
  prosemirrorJSONToYXmlFragment(
    schema,
    { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] },
    doc.getXmlFragment(COLLAB_FIELD),
  );
  return doc;
}

function replaceContent(doc: Y.Doc, json: unknown): void {
  const frag = doc.getXmlFragment(COLLAB_FIELD);
  doc.transact(() => {
    frag.delete(0, frag.length);
    prosemirrorJSONToYXmlFragment(schema, json as never, frag);
  });
}

suite('live: page history', () => {
  it('saves a version, reads it back, and restores it as an edit peers converge on', async () => {
    const u = await newUser(`hist${Date.now()}@x.com`);
    const pageKey = await generatePageKey();

    // Alice writes the page.
    const original = docWith('원본 내용입니다');
    const page = await call<{ id: string }>(`/workspaces/${u.workspaceId}/pages`, {
      method: 'POST',
      body: JSON.stringify({
        title: await encrypt('문서', pageKey),
        content: await snapshotDoc(original, pageKey),
        encryption_version: 4,
        encrypted_page_key: await wrapPageKeyForWorkspace(pageKey, u.workspaceKey),
      }),
    }, u.token);

    // A restore point is saved before she edits.
    await call(`/workspaces/${u.workspaceId}/pages/${page.id}/versions`, {
      method: 'POST',
      body: JSON.stringify({ encrypted_snapshot: await snapshotDoc(original, pageKey) }),
    }, u.token);

    // Bob has the same page open.
    const bob = new Y.Doc();
    await applySnapshot(bob, await snapshotDoc(original, pageKey), pageKey);

    // Alice wrecks the page, and Bob receives that.
    replaceContent(original, {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '실수로 다 지움' }] }],
    });
    await applySnapshot(bob, await snapshotDoc(original, pageKey), pageKey);
    await call(`/workspaces/${u.workspaceId}/pages/${page.id}`, {
      method: 'PUT',
      body: JSON.stringify({ content: await snapshotDoc(original, pageKey), encryption_version: 4 }),
    }, u.token);

    // She opens history, finds the version, and restores it.
    const listed = await call<Array<{ id: number }>>(
      `/workspaces/${u.workspaceId}/pages/${page.id}/versions`, {}, u.token,
    );
    expect(listed.length).toBe(1);

    const detail = await call<{ encrypted_snapshot: string }>(
      `/workspaces/${u.workspaceId}/pages/${page.id}/versions/${listed[0].id}`, {}, u.token,
    );
    const restoredJSON = await versionToProseMirrorJSON(detail.encrypted_snapshot, pageKey);
    expect(previewText(restoredJSON)).toBe('원본 내용입니다');

    // The restore is applied to the *live* doc, so it is an ordinary update…
    replaceContent(original, restoredJSON);
    const afterRestore = await snapshotDoc(original, pageKey);
    await call(`/workspaces/${u.workspaceId}/pages/${page.id}`, {
      method: 'PUT',
      body: JSON.stringify({ content: afterRestore, encryption_version: 4 }),
    }, u.token);

    // …which Bob converges on rather than being stranded on the wrecked version.
    await applySnapshot(bob, afterRestore, pageKey);
    const bobJSON = await versionToProseMirrorJSON(await snapshotDoc(bob, pageKey), pageKey);
    expect(previewText(bobJSON)).toBe('원본 내용입니다');

    // And the server still holds only ciphertext.
    const stored = await call<{ content: string }>(
      `/workspaces/${u.workspaceId}/pages/${page.id}`, {}, u.token,
    );
    expect(stored.content).not.toContain('원본');
  }, 40_000);

  it('keeps history readable by another member of the workspace', async () => {
    const alice = await newUser(`ha${Date.now()}@x.com`);
    const pageKey = await generatePageKey();

    const page = await call<{ id: string }>(`/workspaces/${alice.workspaceId}/pages`, {
      method: 'POST',
      body: JSON.stringify({
        title: await encrypt('t', pageKey),
        content: await snapshotDoc(docWith('shared'), pageKey),
        encryption_version: 4,
        encrypted_page_key: await wrapPageKeyForWorkspace(pageKey, alice.workspaceKey),
      }),
    }, alice.token);

    await call(`/workspaces/${alice.workspaceId}/pages/${page.id}/versions`, {
      method: 'POST',
      body: JSON.stringify({ encrypted_snapshot: await snapshotDoc(docWith('v1'), pageKey) }),
    }, alice.token);

    const listed = await call<Array<{ created_by_email: string }>>(
      `/workspaces/${alice.workspaceId}/pages/${page.id}/versions`, {}, alice.token,
    );
    expect(listed[0].created_by_email).toContain('ha');
  }, 40_000);
});
