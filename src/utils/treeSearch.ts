import type { FamilyNode } from '../types/graph';
import { nodeSearchHaystack } from './nodeDisplayName';

/**
 * Search nodes by first name and family clusters. Case-insensitive substring match.
 * Supports Arabic and English; uses NFC normalization for Unicode variants.
 * @returns Nodes whose searchable text matches the query (trimmed). Empty array if query is empty.
 */
export function searchNodes(nodes: FamilyNode[], query: string): FamilyNode[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const normalizedQuery = trimmed.normalize('NFC').toLowerCase();

  return nodes.filter((node) => {
    const haystack = nodeSearchHaystack(node).normalize('NFC');
    return haystack.toLowerCase().includes(normalizedQuery);
  });
}
