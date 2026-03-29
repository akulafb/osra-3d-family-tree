import type { FamilyLink, FamilyNode } from '../types/graph';

/**
 * Drop links whose source or target is not present in `nodes`.
 * Prevents force-graph / d3 from throwing "node not found" when the DB has
 * inconsistent rows (e.g. link after deleted node, or partial visibility).
 */
export function dropOrphanLinks(nodes: FamilyNode[], links: FamilyLink[]): FamilyLink[] {
  const ids = new Set(nodes.map((n) => n.id));
  return links.filter((l) => ids.has(l.source) && ids.has(l.target));
}
