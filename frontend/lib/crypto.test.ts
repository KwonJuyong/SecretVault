import { describe, it, expect } from 'vitest';
import {
  derivePasswordKey, generateSalt,
  generateKeyPair, exportPublicKey, importPublicKey,
  exportPrivateKeyJwk, importPrivateKeyJwk,
  encryptPrivateKey, decryptPrivateKey,
  generatePageKey, wrapPageKey, unwrapPageKey,
  generateWorkspaceKey, wrapWorkspaceKeyForUser, unwrapWorkspaceKeyForUser,
  wrapPageKeyForWorkspace, unwrapPageKeyFromWorkspace,
  encrypt, decrypt, decryptOrNull, DecryptError,
} from './crypto';

describe('content encryption (AES-GCM)', () => {
  it('round-trips ASCII', async () => {
    const key = await generatePageKey();
    expect(await decrypt(await encrypt('hello', key), key)).toBe('hello');
  });

  it('round-trips Korean and emoji (multi-byte UTF-8)', async () => {
    const key = await generatePageKey();
    const text = '안녕하세요 🔒 SecretVault 한글 테스트';
    expect(await decrypt(await encrypt(text, key), key)).toBe(text);
  });

  it('round-trips content larger than the 8192-byte b64 chunk size', async () => {
    const key = await generatePageKey();
    const text = '가'.repeat(20_000); // ~60KB UTF-8, forces multi-chunk b64Encode
    expect(await decrypt(await encrypt(text, key), key)).toBe(text);
  });

  it('produces a different ciphertext each call (random IV)', async () => {
    const key = await generatePageKey();
    expect(await encrypt('same', key)).not.toBe(await encrypt('same', key));
  });

  it('returns empty string for empty input', async () => {
    const key = await generatePageKey();
    expect(await encrypt('', key)).toBe('');
    expect(await decrypt('', key)).toBe('');
  });

  // These two are the data-loss guard. If decrypt() ever goes back to returning ''
  // on failure, the editor's autosave will overwrite unreadable pages with blank content.
  it('throws (does not return empty) when decrypting with the wrong key', async () => {
    const good = await generatePageKey();
    const wrong = await generatePageKey();
    const ct = await encrypt('secret content', good);
    await expect(decrypt(ct, wrong)).rejects.toThrow(DecryptError);
  });

  it('throws on tampered ciphertext', async () => {
    const key = await generatePageKey();
    const ct = await encrypt('secret content', key);
    const tampered = ct.slice(0, -4) + 'AAAA';
    await expect(decrypt(tampered, key)).rejects.toThrow(DecryptError);
  });

  it('decryptOrNull degrades to null instead of throwing, for read-only surfaces', async () => {
    const good = await generatePageKey();
    const wrong = await generatePageKey();
    const ct = await encrypt('secret content', good);
    expect(await decryptOrNull(ct, wrong)).toBeNull();
    expect(await decryptOrNull(ct, good)).toBe('secret content');
  });
});

describe('page key wrapping (RSA-OAEP)', () => {
  it('wraps and unwraps a page key so content survives the trip', async () => {
    const kp = await generateKeyPair();
    const pageKey = await generatePageKey();
    const ct = await encrypt('shared note', pageKey);

    const wrapped = await wrapPageKey(pageKey, kp.publicKey);
    const unwrapped = await unwrapPageKey(wrapped, kp.privateKey);

    expect(await decrypt(ct, unwrapped)).toBe('shared note');
  });

  it('survives a public key export/import cycle (how sharing actually works)', async () => {
    const kp = await generateKeyPair();
    const pubB64 = await exportPublicKey(kp.publicKey);
    const reimported = await importPublicKey(pubB64);

    const pageKey = await generatePageKey();
    const ct = await encrypt('shared via email lookup', pageKey);
    const wrapped = await wrapPageKey(pageKey, reimported);

    const unwrapped = await unwrapPageKey(wrapped, kp.privateKey);
    expect(await decrypt(ct, unwrapped)).toBe('shared via email lookup');
  });

  it("rejects unwrapping with somebody else's private key", async () => {
    const mine = await generateKeyPair();
    const theirs = await generateKeyPair();
    const wrapped = await wrapPageKey(await generatePageKey(), mine.publicKey);

    await expect(unwrapPageKey(wrapped, theirs.privateKey)).rejects.toThrow();
  });
});

describe('workspace key (design B — the invited-member flow)', () => {
  it('lets an invited member read a page created before they joined', async () => {
    // Alice owns the workspace and writes a page.
    const alice = await generateKeyPair();
    const wsKey = await generateWorkspaceKey();
    const aliceGrant = await wrapWorkspaceKeyForUser(wsKey, alice.publicKey);

    const pageKey = await generatePageKey();
    const ciphertext = await encrypt('회의록: 예산 승인됨', pageKey);
    const pageWrap = await wrapPageKeyForWorkspace(pageKey, wsKey);

    // Bob signs up, and Alice invites him: her client re-wraps the ONE workspace key.
    const bob = await generateKeyPair();
    const aliceWsKey = await unwrapWorkspaceKeyForUser(aliceGrant, alice.privateKey);
    const bobGrant = await wrapWorkspaceKeyForUser(aliceWsKey, bob.publicKey);

    // Bob logs in and opens the pre-existing page. This is what fails today.
    const bobWsKey = await unwrapWorkspaceKeyForUser(bobGrant, bob.privateKey);
    const bobPageKey = await unwrapPageKeyFromWorkspace(pageWrap, bobWsKey);

    expect(await decrypt(ciphertext, bobPageKey)).toBe('회의록: 예산 승인됨');
  });

  it('lets an invited member read a page created AFTER they joined, with no extra grant', async () => {
    const bob = await generateKeyPair();
    const wsKey = await generateWorkspaceKey();
    const bobGrant = await wrapWorkspaceKeyForUser(wsKey, bob.publicKey);

    // Alice creates a new page long after Bob was invited. Nobody touches Bob's grants.
    const pageKey = await generatePageKey();
    const ciphertext = await encrypt('나중에 만든 페이지', pageKey);
    const pageWrap = await wrapPageKeyForWorkspace(pageKey, wsKey);

    const bobWsKey = await unwrapWorkspaceKeyForUser(bobGrant, bob.privateKey);
    const bobPageKey = await unwrapPageKeyFromWorkspace(pageWrap, bobWsKey);
    expect(await decrypt(ciphertext, bobPageKey)).toBe('나중에 만든 페이지');
  });

  it('a member can also write, and the owner can read it back', async () => {
    const alice = await generateKeyPair();
    const wsKey = await generateWorkspaceKey();
    const bob = await generateKeyPair();
    const bobGrant = await wrapWorkspaceKeyForUser(wsKey, bob.publicKey);
    const aliceGrant = await wrapWorkspaceKeyForUser(wsKey, alice.publicKey);

    // Bob creates a page.
    const bobWsKey = await unwrapWorkspaceKeyForUser(bobGrant, bob.privateKey);
    const pageKey = await generatePageKey();
    const ciphertext = await encrypt("bob's note", pageKey);
    const pageWrap = await wrapPageKeyForWorkspace(pageKey, bobWsKey);

    // Alice reads it.
    const aliceWsKey = await unwrapWorkspaceKeyForUser(aliceGrant, alice.privateKey);
    const alicePageKey = await unwrapPageKeyFromWorkspace(pageWrap, aliceWsKey);
    expect(await decrypt(ciphertext, alicePageKey)).toBe("bob's note");
  });

  it('shuts out a non-member: their private key cannot open the workspace grant', async () => {
    const alice = await generateKeyPair();
    const outsider = await generateKeyPair();
    const wsKey = await generateWorkspaceKey();
    const aliceGrant = await wrapWorkspaceKeyForUser(wsKey, alice.publicKey);

    await expect(unwrapWorkspaceKeyForUser(aliceGrant, outsider.privateKey)).rejects.toThrow();
  });

  it("shuts out another workspace's key from unwrapping this workspace's pages", async () => {
    const wsA = await generateWorkspaceKey();
    const wsB = await generateWorkspaceKey();
    const pageWrap = await wrapPageKeyForWorkspace(await generatePageKey(), wsA);

    await expect(unwrapPageKeyFromWorkspace(pageWrap, wsB)).rejects.toThrow();
  });

  it('still supports per-page sharing to an outsider via RSA (page_shares path)', async () => {
    // Design B keeps the existing external-share mechanism working alongside it.
    const wsKey = await generateWorkspaceKey();
    const pageKey = await generatePageKey();
    const ciphertext = await encrypt('shared outside the workspace', pageKey);
    await wrapPageKeyForWorkspace(pageKey, wsKey); // members' path

    const outsider = await generateKeyPair();
    const directGrant = await wrapPageKey(pageKey, outsider.publicKey); // outsider's path

    const recovered = await unwrapPageKey(directGrant, outsider.privateKey);
    expect(await decrypt(ciphertext, recovered)).toBe('shared outside the workspace');
  });
});

describe('private key at rest (PBKDF2 + AES-GCM)', () => {
  it('round-trips the private key through a password', async () => {
    const kp = await generateKeyPair();
    const salt = generateSalt();
    const passwordKey = await derivePasswordKey('correct horse battery', salt);

    const { encrypted, iv } = await encryptPrivateKey(kp.privateKey, passwordKey);
    const recovered = await decryptPrivateKey(encrypted, iv, passwordKey);

    // The recovered key must still unwrap page keys wrapped for the original pair.
    const pageKey = await generatePageKey();
    const ct = await encrypt('after re-login', pageKey);
    const wrapped = await wrapPageKey(pageKey, kp.publicKey);
    expect(await decrypt(ct, await unwrapPageKey(wrapped, recovered))).toBe('after re-login');
  });

  it('fails to decrypt the private key with a wrong password', async () => {
    const kp = await generateKeyPair();
    const salt = generateSalt();
    const right = await derivePasswordKey('right-password', salt);
    const wrong = await derivePasswordKey('wrong-password', salt);

    const { encrypted, iv } = await encryptPrivateKey(kp.privateKey, right);
    await expect(decryptPrivateKey(encrypted, iv, wrong)).rejects.toThrow();
  });

  it('fails to decrypt the private key with a wrong salt', async () => {
    const kp = await generateKeyPair();
    const right = await derivePasswordKey('same-password', generateSalt());
    const wrong = await derivePasswordKey('same-password', generateSalt());

    const { encrypted, iv } = await encryptPrivateKey(kp.privateKey, right);
    await expect(decryptPrivateKey(encrypted, iv, wrong)).rejects.toThrow();
  });

  it('survives the sessionStorage JWK round-trip used on page reload', async () => {
    const kp = await generateKeyPair();
    // exportPrivateKeyJwk returns the JSON string that AuthContext puts in sessionStorage.
    const stored: string = await exportPrivateKeyJwk(kp.privateKey);
    const restored = await importPrivateKeyJwk(stored);

    const pageKey = await generatePageKey();
    const ct = await encrypt('after refresh', pageKey);
    const wrapped = await wrapPageKey(pageKey, kp.publicKey);
    expect(await decrypt(ct, await unwrapPageKey(wrapped, restored))).toBe('after refresh');
  });
});
