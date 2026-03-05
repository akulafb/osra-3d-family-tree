import type { FamilyNode } from '../types/graph';

/**
 * Search nodes by name. Case-insensitive substring match.
 * Supports Arabic and English; uses NFC normalization for Unicode variants.
 * @returns Nodes whose name matches the query (trimmed). Empty array if query is empty.
 */
export function searchNodes(nodes: FamilyNode[], query: string): FamilyNode[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const normalizedQuery = trimmed.normalize('NFC').toLowerCase();

  return nodes.filter((node) => {
    const name = (node.name ?? '').normalize('NFC');
    return name.toLowerCase().includes(normalizedQuery);
  });
}
