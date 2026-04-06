import type { FamilyNode } from '../types/graph';

/** Single-line label: "First PaternalCluster" (or either part if one is missing). */
export function formatNodeDisplayName(
  node: Pick<FamilyNode, 'firstName' | 'familyCluster'>
): string {
  const f = (node.firstName ?? '').trim();
  const c = (node.familyCluster ?? '').trim();
  if (f && c) return `${f} ${c}`;
  return f || c || 'Unknown';
}

/** Text used for search: given name plus both clusters. */
export function nodeSearchHaystack(
  node: Pick<FamilyNode, 'firstName' | 'familyCluster' | 'maternalFamilyCluster'>
): string {
  return [node.firstName, node.familyCluster, node.maternalFamilyCluster]
    .filter((s) => s && String(s).trim())
    .join(' ');
}
