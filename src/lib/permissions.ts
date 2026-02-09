// Permission utilities for 1-degree network access control
// These helpers check if the current user can perform actions on specific nodes

import { FamilyNode, FamilyLink } from '../types/graph';

import { supabase } from './supabase';

export type RelationshipType = 'self' | 'parent' | 'child' | 'spouse' | 'sibling' | 'unrelated';

/**
 * Check if current user can edit a specific node
 * Rules:
 * - Admin can edit any node
 * - User can edit nodes within their 1-degree network (self, parents, children, siblings, spouse)
 */
export async function canEditNode(
  targetNodeId: string,
  userId: string
): Promise<boolean> {
  try {
    // First check if user is admin
    const { data: isAdmin } = await supabase.rpc('is_admin');
    if (isAdmin) return true;

    // Get user's bound node
    const { data: userData } = await supabase
      .from('users')
      .select('node_id')
      .eq('id', userId)
      .single();
    
    const userNodeId = userData?.node_id;
    if (!userNodeId) return false;

    // User can always edit their own node
    if (targetNodeId === userNodeId) return true;

    // Get all links
    const { data: links } = await supabase.from('links').select('*');
    if (!links) return false;

    // Check if node is within 1-degree network
    return isWithin1Degree(targetNodeId, userNodeId, links);
  } catch (err) {
    console.error('Error checking edit permission:', err);
    return false;
  }
}

/**
 * SYNCHRONOUS version: Check if current user can edit a specific node
 * This uses cached data (from graph) which has 'source'/'target' format
 * Rules:
 * - Admin can edit any node
 * - User can edit nodes within their 1-degree network
 */
export function canEdit(
  nodeId: string,
  userNodeId: string | null | undefined,
  isAdmin: boolean,
  links: FamilyLink[]
): boolean {
  // Admins can edit anything
  if (isAdmin) return true;

  // If user has no node binding, they can't edit anything
  if (!userNodeId) return false;

  // User can always edit their own node
  if (nodeId === userNodeId) return true;

  // Check if node is within 1-degree network
  return isWithin1Degree(nodeId, userNodeId, links);
}

/**
 * SYNCHRONOUS version: Check if user can manage invites for a node
 * Same rules as canEdit - 1-degree network + admin
 */
export function canManageInvites(
  nodeId: string,
  userNodeId: string | null | undefined,
  isAdmin: boolean,
  links: FamilyLink[]
): boolean {
  // Same permissions as edit - 1-degree network control
  return canEdit(nodeId, userNodeId, isAdmin, links);
}

/**
 * Safely extracts an ID from a link property (handles string or object)
 */
function getSafeId(val: any): string | null {
  if (!val) return null;
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && val.id) return val.id;
  return null;
}

/**
 * Check if target node is within 1-degree of user's node
 * 1-degree = self, parents, children, siblings, spouse
 */
export function isWithin1Degree(
  targetNodeId: string,
  userNodeId: string,
  links: FamilyLink[]
): boolean {
  if (!links || !Array.isArray(links)) return false;
  
  // Check for direct connection via any link type
  const hasDirectLink = links.some((link: any) => {
    const s = getSafeId(link.source);
    const t = getSafeId(link.target);
    return (s === userNodeId && t === targetNodeId) || (t === userNodeId && s === targetNodeId);
  });

  if (hasDirectLink) return true;

  // Check for siblings (share a parent)
  const userParents = getParents(userNodeId, links);
  const targetParents = getParents(targetNodeId, links);
  const sharesParent = userParents.some(parent => targetParents.includes(parent));

  if (sharesParent) return true;

  return false;
}

// Helper: Get parent nodes of a given node
function getParents(nodeId: string, links: FamilyLink[]): string[] {
  if (!links || !Array.isArray(links)) return [];
  return links
    .filter((link: any) => {
      const t = getSafeId(link.target);
      return t === nodeId && link.type === 'parent';
    })
    .map((link: any) => getSafeId(link.source))
    .filter(Boolean) as string[];
}

// Helper: Get child nodes of a given node
function getChildren(nodeId: string, links: FamilyLink[]): string[] {
  if (!links || !Array.isArray(links)) return [];
  return links
    .filter((link: any) => {
      const s = getSafeId(link.source);
      return s === nodeId && link.type === 'parent';
    })
    .map((link: any) => getSafeId(link.target))
    .filter(Boolean) as string[];
}

/**
 * Get the relationship between user's node and target node
 */
export async function getNodeRelationship(
  userId: string,
  targetNodeId: string
): Promise<{ type: RelationshipType; label: string }> {
  try {
    const { data: userData } = await supabase.from('users').select('node_id').eq('id', userId).single();
    const userNodeId = userData?.node_id;
    if (!userNodeId) return { type: 'unrelated', label: 'Not bound' };
    if (targetNodeId === userNodeId) return { type: 'self', label: 'You' };

    const { data: links } = await supabase.from('links').select('*');
    if (!links) return { type: 'unrelated', label: 'No links' };

    // Standardize links
    const familyLinks: FamilyLink[] = (links || []).map((link: any) => ({
      source: link.source_node_id,
      target: link.target_node_id,
      type: link.type as 'parent' | 'marriage',
    }));

    const directLink = familyLinks.find(link => 
      (link.source === userNodeId && link.target === targetNodeId) ||
      (link.target === userNodeId && link.source === targetNodeId)
    );

    if (directLink) {
      if (directLink.type === 'parent') {
        return directLink.source === targetNodeId ? { type: 'parent', label: 'Parent' } : { type: 'child', label: 'Child' };
      }
      return { type: 'spouse', label: 'Spouse' };
    }

    const userParents = getParents(userNodeId, familyLinks);
    const targetParents = getParents(targetNodeId, familyLinks);
    if (userParents.some(p => targetParents.includes(p))) return { type: 'sibling', label: 'Sibling' };

    return { type: 'unrelated', label: 'Not 1-degree' };
  } catch (err) {
    return { type: 'unrelated', label: 'Error' };
  }
}

/**
 * Get all nodes within 1-degree of the user's bound node (sync version)
 */
export function get1DegreeNodesSync(
  userNodeId: string | null | undefined,
  nodes: FamilyNode[],
  links: FamilyLink[]
): string[] {
  if (!userNodeId || !links || !Array.isArray(links)) return [];

  const oneDegreeIds = new Set<string>([userNodeId]);

  links.forEach((link: any) => {
    const s = getSafeId(link.source);
    const t = getSafeId(link.target);
    if (s === userNodeId && t) oneDegreeIds.add(t);
    else if (t === userNodeId && s) oneDegreeIds.add(s);
  });

  const userParents = getParents(userNodeId, links);
  userParents.forEach(parentId => {
    const siblings = getChildren(parentId, links).filter(id => id !== userNodeId);
    siblings.forEach(id => oneDegreeIds.add(id));
  });

  return Array.from(oneDegreeIds);
}

/**
 * Check if a link can be created between two nodes
 */
export function canCreateLink(
  sourceNodeId: string,
  targetNodeId: string,
  linkType: 'parent' | 'sibling' | 'marriage',
  userNodeId: string | null | undefined,
  isAdmin: boolean,
  existingLinks: FamilyLink[]
): { allowed: boolean; reason?: string } {
  if (sourceNodeId === targetNodeId) return { allowed: false, reason: 'Self-link' };

  const exists = existingLinks.some((link: any) => {
    const s = getSafeId(link.source);
    const t = getSafeId(link.target);
    return (s === sourceNodeId && t === targetNodeId) || (s === targetNodeId && t === sourceNodeId);
  });
  if (exists) return { allowed: false, reason: 'Exists' };

  if (isAdmin) return { allowed: true };
  if (!userNodeId) return { allowed: false };

  if (!isWithin1Degree(sourceNodeId, userNodeId, existingLinks) && !isWithin1Degree(targetNodeId, userNodeId, existingLinks)) {
    return { allowed: false, reason: 'Not in network' };
  }

  return { allowed: true };
}
