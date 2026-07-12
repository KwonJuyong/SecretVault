import { describe, it, expect } from 'vitest';
import {
  createInviteSecret, deriveInviteKeys,
  wrapWorkspaceKeyForInvite, unwrapWorkspaceKeyFromInvite,
  buildInviteLink, parseInviteFragment,
} from './invite';
import {
  generateWorkspaceKey, generateKeyPair,
  wrapWorkspaceKeyForUser, unwrapWorkspaceKeyForUser,
  generatePageKey, wrapPageKeyForWorkspace, unwrapPageKeyFromWorkspace,
  encrypt, decrypt,
} from './crypto';

describe('invite secrets', () => {
  it('are unique', () => {
    const seen = new Set(Array.from({ length: 50 }, () => createInviteSecret()));
    expect(seen.size).toBe(50);
  });

  it('derive the same two keys every time from the same secret', async () => {
    const secret = createInviteSecret();
    const a = await deriveInviteKeys(secret);
    const b = await deriveInviteKeys(secret);
    expect(a.authToken).toBe(b.authToken);

    // And the wrap keys are interchangeable.
    const wsKey = await generateWorkspaceKey();
    const wrapped = await wrapWorkspaceKeyForInvite(wsKey, a.wrapKey);
    await expect(unwrapWorkspaceKeyFromInvite(wrapped, b.wrapKey)).resolves.toBeTruthy();
  });

  it('derives different keys from different secrets', async () => {
    const a = await deriveInviteKeys(createInviteSecret());
    const b = await deriveInviteKeys(createInviteSecret());
    expect(a.authToken).not.toBe(b.authToken);
  });

  it('marks the wrap key non-extractable so it cannot be exported and sent anywhere', async () => {
    const { authToken, wrapKey } = await deriveInviteKeys(createInviteSecret());
    expect(wrapKey.extractable).toBe(false);
    expect(authToken.length).toBeGreaterThan(20);
    await expect(crypto.subtle.exportKey('raw', wrapKey)).rejects.toThrow();
  });
});

describe('invite link', () => {
  it('puts the secret in the fragment, never the path or query', () => {
    const secret = createInviteSecret();
    const link = buildInviteLink('https://vault.example.com', 'abc-123', secret);

    const url = new URL(link);
    expect(url.pathname).toBe('/invite');
    expect(url.search).toBe('');            // nothing in the query string
    expect(url.hash).toContain(secret);     // only in the fragment
    // A fragment is never sent to the server, so the secret cannot reach it.
    expect(url.href.split('#')[0]).not.toContain(secret);
  });

  it('round-trips through parseInviteFragment', () => {
    const secret = createInviteSecret();
    const link = buildInviteLink('https://x.test', 'inv-9', secret);
    expect(parseInviteFragment(new URL(link).hash)).toEqual({ inviteId: 'inv-9', secret });
  });

  it('rejects a malformed fragment', () => {
    expect(parseInviteFragment('')).toBeNull();
    expect(parseInviteFragment('#')).toBeNull();
    expect(parseInviteFragment('#no-dot-here')).toBeNull();
    expect(parseInviteFragment('#.secret-only')).toBeNull();
    expect(parseInviteFragment('#id-only.')).toBeNull();
  });
});

describe('the full invite flow', () => {
  it('lets someone with no account end up able to read the workspace', async () => {
    // --- Alice has a workspace with a page in it ------------------------------
    const wsKey = await generateWorkspaceKey();
    const pageKey = await generatePageKey();
    const ciphertext = await encrypt('사내 정책 문서', pageKey);
    const pageWrap = await wrapPageKeyForWorkspace(pageKey, wsKey);

    // --- Alice creates an invite link ----------------------------------------
    const secret = createInviteSecret();
    const inviterKeys = await deriveInviteKeys(secret);
    // This blob is what the server stores. It is wrapped under the link's secret.
    const inviteBlob = await wrapWorkspaceKeyForInvite(wsKey, inviterKeys.wrapKey);
    const link = buildInviteLink('https://vault.test', 'invite-1', secret);

    // --- Bob, who has no account, opens the link and signs up -----------------
    const parsed = parseInviteFragment(new URL(link).hash)!;
    const bobKeys = await deriveInviteKeys(parsed.secret);
    const bob = await generateKeyPair(); // created during signup

    // He proves he holds the link, gets the blob back, and opens it.
    expect(bobKeys.authToken).toBe(inviterKeys.authToken);
    const recoveredWsKey = await unwrapWorkspaceKeyFromInvite(inviteBlob, bobKeys.wrapKey);

    // He re-wraps the workspace key under his brand-new RSA key: that grant is what
    // persists, so the invite link becomes worthless afterwards.
    const bobGrant = await wrapWorkspaceKeyForUser(recoveredWsKey, bob.publicKey);

    // --- Bob logs in later and reads Alice's page ----------------------------
    const bobWsKey = await unwrapWorkspaceKeyForUser(bobGrant, bob.privateKey);
    const bobPageKey = await unwrapPageKeyFromWorkspace(pageWrap, bobWsKey);
    expect(await decrypt(ciphertext, bobPageKey)).toBe('사내 정책 문서');
  });

  it('shuts out someone with a different secret', async () => {
    const wsKey = await generateWorkspaceKey();
    const real = await deriveInviteKeys(createInviteSecret());
    const forged = await deriveInviteKeys(createInviteSecret());

    const blob = await wrapWorkspaceKeyForInvite(wsKey, real.wrapKey);

    expect(forged.authToken).not.toBe(real.authToken); // server rejects them first
    await expect(unwrapWorkspaceKeyFromInvite(blob, forged.wrapKey)).rejects.toThrow();
  });

  it('leaves the stored blob useless to the server, which only ever sees the authToken', async () => {
    const wsKey = await generateWorkspaceKey();
    const { authToken, wrapKey } = await deriveInviteKeys(createInviteSecret());
    const blob = await wrapWorkspaceKeyForInvite(wsKey, wrapKey);

    // Everything the server holds: the blob and (a hash of) the authToken. Deriving the
    // wrap key from the authToken must be impossible — they are separate HKDF outputs.
    const fromAuth = await crypto.subtle.importKey(
      'raw',
      Uint8Array.from(atob(authToken.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)),
      { name: 'AES-KW' }, false, ['unwrapKey'],
    );
    await expect(unwrapWorkspaceKeyFromInvite(blob, fromAuth)).rejects.toThrow();
  });
});
