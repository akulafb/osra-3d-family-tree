/**
 * Safely get node ID from string, object with id, or null/undefined.
 */
export function getNodeId(nodeOrId: unknown): string {
  if (!nodeOrId) return '';
  if (typeof nodeOrId === 'object' && nodeOrId !== null && 'id' in nodeOrId) {
    return String((nodeOrId as { id?: unknown }).id ?? '');
  }
  if (typeof nodeOrId === 'string') return nodeOrId;
  return '';
}
