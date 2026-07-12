import type { PageTreeItem } from './types';

export type DropMode = 'before' | 'after' | 'inside';

export interface Move {
  parentId: string | null;
  position: number;
}

/** Immediate children of `parentId` (null = top level), in their stored order. */
export function childrenOf(pages: PageTreeItem[], parentId: string | null): PageTreeItem[] {
  return pages
    .filter(p => (p.parent_id ?? null) === parentId)
    .sort((a, b) => a.position - b.position);
}

/** Walk up from `pageId` to the root. Returns [root, …, page]. */
export function breadcrumbTrail(pages: PageTreeItem[], pageId: string): PageTreeItem[] {
  const byId = new Map(pages.map(p => [p.id, p]));
  const trail: PageTreeItem[] = [];
  const seen = new Set<string>();

  let current = byId.get(pageId);
  while (current && !seen.has(current.id)) {
    seen.add(current.id); // a corrupt cycle must not hang the sidebar
    trail.unshift(current);
    current = current.parent_id ? byId.get(current.parent_id) : undefined;
  }
  return trail;
}

/** True if `candidateId` is `pageId` itself or lives somewhere beneath it. */
export function isSelfOrDescendant(
  pages: PageTreeItem[], candidateId: string, pageId: string,
): boolean {
  if (candidateId === pageId) return true;
  const byId = new Map(pages.map(p => [p.id, p]));
  const seen = new Set<string>();

  let current = byId.get(candidateId);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    if (current.parent_id === pageId) return true;
    current = current.parent_id ? byId.get(current.parent_id) : undefined;
  }
  return false;
}

/**
 * Where a dragged page lands when dropped on a target.
 *
 * Returns null for a move that must not happen — dropping a page onto itself, or into its
 * own subtree, which would detach that subtree from the root and (before the server grew a
 * guard) send the recursive delete walk into infinite recursion.
 *
 * Positions are fractional midpoints rather than a renumbering of every sibling: one page
 * moves, so exactly one row should have to be written.
 */
export function computeDrop(
  pages: PageTreeItem[],
  draggedId: string,
  targetId: string,
  mode: DropMode,
): Move | null {
  if (draggedId === targetId) return null;
  if (isSelfOrDescendant(pages, targetId, draggedId)) return null;

  const target = pages.find(p => p.id === targetId);
  if (!target) return null;

  if (mode === 'inside') {
    const siblings = childrenOf(pages, targetId).filter(p => p.id !== draggedId);
    const last = siblings[siblings.length - 1];
    return { parentId: targetId, position: last ? last.position + 1 : 1 };
  }

  const parentId = target.parent_id ?? null;
  const siblings = childrenOf(pages, parentId).filter(p => p.id !== draggedId);
  const index = siblings.findIndex(p => p.id === targetId);
  if (index === -1) return null;

  const before = mode === 'before' ? siblings[index - 1] : siblings[index];
  const after = mode === 'before' ? siblings[index] : siblings[index + 1];

  let position: number;
  if (before && after) position = (before.position + after.position) / 2;
  else if (after) position = after.position - 1;           // dropped at the very top
  else if (before) position = before.position + 1;         // dropped at the very bottom
  else position = 1;                                       // only child

  return { parentId, position };
}
