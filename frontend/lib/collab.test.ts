import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { generatePageKey } from './crypto';
import { sealUpdate, openUpdate, snapshotDoc, applySnapshot } from './collab';

/** Apply everything doc A knows onto doc B, through the encrypted path. */
async function sync(from: Y.Doc, to: Y.Doc, key: CryptoKey) {
  const sealed = await snapshotDoc(from, key);
  await applySnapshot(to, sealed, key);
}

describe('encrypted Yjs transport', () => {
  it('round-trips an update through encryption', async () => {
    const key = await generatePageKey();
    const doc = new Y.Doc();
    doc.getText('body').insert(0, '안녕하세요');

    const sealed = await sealUpdate(Y.encodeStateAsUpdate(doc), key);
    const restored = new Y.Doc();
    Y.applyUpdate(restored, await openUpdate(sealed, key));

    expect(restored.getText('body').toString()).toBe('안녕하세요');
  });

  it('produces ciphertext, not readable content', async () => {
    const key = await generatePageKey();
    const doc = new Y.Doc();
    doc.getText('body').insert(0, 'TOP SECRET BUDGET');

    const sealed = await snapshotDoc(doc, key);
    expect(sealed).not.toContain('SECRET');
    expect(atob(sealed)).not.toContain('SECRET');
  });

  it('cannot be opened with the wrong page key', async () => {
    const right = await generatePageKey();
    const wrong = await generatePageKey();
    const doc = new Y.Doc();
    doc.getText('body').insert(0, 'secret');

    const sealed = await snapshotDoc(doc, right);
    await expect(openUpdate(sealed, wrong)).rejects.toThrow();
  });
});

describe('concurrent editing (the data loss this replaces)', () => {
  it('merges two people typing at once instead of one overwriting the other', async () => {
    const key = await generatePageKey();

    // Alice and Bob both open the same page.
    const alice = new Y.Doc();
    alice.getText('body').insert(0, 'Hello world');
    const bob = new Y.Doc();
    await sync(alice, bob, key);

    // They type at the same time, neither seeing the other yet.
    alice.getText('body').insert(0, 'Alice: ');
    bob.getText('body').insert(11, ' — Bob was here');

    // Their updates reach each other.
    await sync(alice, bob, key);
    await sync(bob, alice, key);

    const merged = alice.getText('body').toString();
    expect(merged).toBe(bob.getText('body').toString()); // converged
    expect(merged).toContain('Alice: ');
    expect(merged).toContain('Bob was here');
    expect(merged).toContain('Hello world');
  });

  it('converges no matter which order the updates arrive in', async () => {
    const key = await generatePageKey();
    const base = new Y.Doc();
    base.getText('body').insert(0, 'start');

    const a = new Y.Doc();
    const b = new Y.Doc();
    await sync(base, a, key);
    await sync(base, b, key);

    a.getText('body').insert(5, '-A');
    b.getText('body').insert(5, '-B');

    // b <- a, then a <- b  (reverse order from the previous test)
    await sync(a, b, key);
    await sync(b, a, key);

    expect(a.getText('body').toString()).toBe(b.getText('body').toString());
  });

  it('a late joiner catches up to the full document', async () => {
    const key = await generatePageKey();
    const alice = new Y.Doc();
    alice.getText('body').insert(0, 'written before they joined');

    const latecomer = new Y.Doc();
    await applySnapshot(latecomer, await snapshotDoc(alice, key), key);

    expect(latecomer.getText('body').toString()).toBe('written before they joined');
  });

  it('an offline edit is not lost when the client reconnects', async () => {
    const key = await generatePageKey();
    const server = new Y.Doc();
    server.getText('body').insert(0, 'shared');

    const offline = new Y.Doc();
    await sync(server, offline, key);

    // Offline client types while disconnected; meanwhile someone else edits.
    offline.getText('body').insert(6, ' [offline edit]');
    server.getText('body').insert(0, '[live edit] ');

    // Reconnect: both directions replay.
    await sync(offline, server, key);
    await sync(server, offline, key);

    const text = server.getText('body').toString();
    expect(text).toBe(offline.getText('body').toString());
    expect(text).toContain('[offline edit]');
    expect(text).toContain('[live edit]');
  });
});
