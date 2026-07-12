import { describe, it, expect } from 'vitest';
import { computeDrop, breadcrumbTrail, isSelfOrDescendant, childrenOf } from './tree';
import type { PageTreeItem } from './types';

const page = (id: string, parent: string | null, position: number): PageTreeItem => ({
  id, parent_id: parent, position,
  title: '', icon: '', has_children: false,
  encryption_version: 4, encrypted_page_key: null, updated_at: null,
});

//  a (1)
//  ├─ a1 (1)
//  └─ a2 (2)
//     └─ a2x (1)
//  b (2)
//  c (3)
const tree: PageTreeItem[] = [
  page('a', null, 1), page('b', null, 2), page('c', null, 3),
  page('a1', 'a', 1), page('a2', 'a', 2),
  page('a2x', 'a2', 1),
];

describe('childrenOf', () => {
  it('returns top-level pages in order', () => {
    expect(childrenOf(tree, null).map(p => p.id)).toEqual(['a', 'b', 'c']);
  });

  it('returns a page’s children in order', () => {
    expect(childrenOf(tree, 'a').map(p => p.id)).toEqual(['a1', 'a2']);
  });
});

describe('isSelfOrDescendant', () => {
  it('is true for the page itself', () => {
    expect(isSelfOrDescendant(tree, 'a', 'a')).toBe(true);
  });

  it('is true for a direct child and a grandchild', () => {
    expect(isSelfOrDescendant(tree, 'a2', 'a')).toBe(true);
    expect(isSelfOrDescendant(tree, 'a2x', 'a')).toBe(true);
  });

  it('is false for a sibling', () => {
    expect(isSelfOrDescendant(tree, 'b', 'a')).toBe(false);
  });
});

describe('computeDrop', () => {
  it('refuses to drop a page on itself', () => {
    expect(computeDrop(tree, 'a', 'a', 'inside')).toBeNull();
  });

  it('refuses to drop a page into its own subtree', () => {
    // This is the move that used to create a cycle and blow the recursive delete's stack.
    expect(computeDrop(tree, 'a', 'a2x', 'inside')).toBeNull();
    expect(computeDrop(tree, 'a', 'a1', 'before')).toBeNull();
  });

  it('nests a page under the target when dropped inside', () => {
    expect(computeDrop(tree, 'c', 'a', 'inside')).toEqual({ parentId: 'a', position: 3 });
  });

  it('drops between two siblings using a fractional midpoint', () => {
    // c dropped after a  →  lands between a (1) and b (2)
    expect(computeDrop(tree, 'c', 'a', 'after')).toEqual({ parentId: null, position: 1.5 });
  });

  it('drops above the first sibling', () => {
    expect(computeDrop(tree, 'c', 'a', 'before')).toEqual({ parentId: null, position: 0 });
  });

  it('drops below the last sibling', () => {
    expect(computeDrop(tree, 'a', 'c', 'after')).toEqual({ parentId: null, position: 4 });
  });

  it('moves a nested page back out to the top level', () => {
    // a1 dropped after b → leaves its parent, parentId becomes null
    expect(computeDrop(tree, 'a1', 'b', 'after')).toEqual({ parentId: null, position: 2.5 });
  });

  it('ignores the dragged page when measuring its new neighbours', () => {
    // b dropped before c: b is removed from the sibling list first, so it lands between
    // a (1) and c (3), not between itself and c.
    expect(computeDrop(tree, 'b', 'c', 'before')).toEqual({ parentId: null, position: 2 });
  });

  it('keeps ordering stable when a midpoint is reused repeatedly', () => {
    // Fractional positions must not collapse: dropping between 1 and 1.5 gives 1.25.
    const tight = [page('x', null, 1), page('y', null, 1.5), page('z', null, 9)];
    expect(computeDrop(tight, 'z', 'y', 'before')).toEqual({ parentId: null, position: 1.25 });
  });
});

describe('breadcrumbTrail', () => {
  it('walks from the root down to the page', () => {
    expect(breadcrumbTrail(tree, 'a2x').map(p => p.id)).toEqual(['a', 'a2', 'a2x']);
  });

  it('is just the page itself at the top level', () => {
    expect(breadcrumbTrail(tree, 'b').map(p => p.id)).toEqual(['b']);
  });

  it('does not hang if the data somehow contains a cycle', () => {
    const cyclic = [page('p', 'q', 1), page('q', 'p', 1)];
    expect(breadcrumbTrail(cyclic, 'p').length).toBeLessThanOrEqual(2);
  });
});
