import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { prosemirrorJSONToYXmlFragment, yXmlFragmentToProsemirrorJSON } from 'y-prosemirror';
import { Schema } from '@tiptap/pm/model';
import { generatePageKey } from './crypto';
import { snapshotDoc, sealUpdate, applySnapshot } from './collab';
import { versionToProseMirrorJSON, previewText, COLLAB_FIELD } from './history';

// A minimal ProseMirror schema — enough to round-trip paragraphs of text.
const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'inline*', toDOM: () => ['p', 0] },
    text: { group: 'inline' },
  },
});

/** Build a Y.Doc holding the given paragraphs, the way the editor would. */
function docWith(paragraphs: string[]): Y.Doc {
  const doc = new Y.Doc();
  const json = {
    type: 'doc',
    content: paragraphs.map(text => ({
      type: 'paragraph',
      content: text ? [{ type: 'text', text }] : [],
    })),
  };
  prosemirrorJSONToYXmlFragment(schema, json, doc.getXmlFragment(COLLAB_FIELD));
  return doc;
}

describe('reading a version back', () => {
  it('recovers the document content from an encrypted snapshot', async () => {
    const key = await generatePageKey();
    const sealed = await snapshotDoc(docWith(['1분기 매출 보고', '전년 대비 12% 증가']), key);

    const json = await versionToProseMirrorJSON(sealed, key);
    expect(previewText(json)).toBe('1분기 매출 보고 전년 대비 12% 증가');
  });

  it('cannot read a version with the wrong page key', async () => {
    const sealed = await snapshotDoc(docWith(['secret']), await generatePageKey());
    await expect(versionToProseMirrorJSON(sealed, await generatePageKey())).rejects.toThrow();
  });

  it('handles an empty document', async () => {
    const key = await generatePageKey();
    const sealed = await snapshotDoc(docWith(['']), key);
    expect(previewText(await versionToProseMirrorJSON(sealed, key))).toBe('');
  });
});

describe('previewText', () => {
  it('truncates long content', () => {
    const json = { type: 'doc', content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'a'.repeat(300) }] },
    ] };
    const out = previewText(json, 50);
    expect(out.length).toBe(51); // 50 chars plus the ellipsis
    expect(out.endsWith('…')).toBe(true);
  });

  it('survives odd shapes without throwing', () => {
    expect(previewText(null)).toBe('');
    expect(previewText(undefined)).toBe('');
    expect(previewText({})).toBe('');
    expect(previewText({ type: 'doc' })).toBe('');
  });
});

describe('restoring is a merge, not a swap', () => {
  it('a restore reaches other peers, instead of leaving them on the old content', async () => {
    const key = await generatePageKey();

    // Alice and Bob both have the page open, sharing the same document.
    const alice = docWith(['original text']);
    const bob = new Y.Doc();
    await applySnapshot(bob, await snapshotDoc(alice, key), key);

    // A version was saved at this point.
    const version = await snapshotDoc(alice, key);

    // Then the page is edited — badly.
    alice.getXmlFragment(COLLAB_FIELD).delete(0, alice.getXmlFragment(COLLAB_FIELD).length);
    prosemirrorJSONToYXmlFragment(
      schema,
      { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'oops' }] }] },
      alice.getXmlFragment(COLLAB_FIELD),
    );
    await applySnapshot(bob, await snapshotDoc(alice, key), key);
    expect(previewText(yjsToJSON(bob))).toBe('oops');

    // Alice restores the version. Expressed as an edit on the *live* doc — the very thing
    // that makes it reach Bob. Swapping in a fresh Y.Doc would have left him on 'oops'
    // forever, with no update to tell him otherwise.
    const restoredJSON = await versionToProseMirrorJSON(version, key);
    const frag = alice.getXmlFragment(COLLAB_FIELD);
    alice.transact(() => {
      frag.delete(0, frag.length);
      prosemirrorJSONToYXmlFragment(schema, restoredJSON as never, frag);
    });

    // Bob receives it as an ordinary update and converges.
    const update = await sealUpdate(Y.encodeStateAsUpdate(alice), key);
    await applySnapshot(bob, update, key);

    expect(previewText(yjsToJSON(bob))).toBe('original text');
    expect(previewText(yjsToJSON(bob))).toBe(previewText(yjsToJSON(alice)));
  });
});

function yjsToJSON(doc: Y.Doc): unknown {
  return yXmlFragmentToProsemirrorJSON(doc.getXmlFragment(COLLAB_FIELD));
}
