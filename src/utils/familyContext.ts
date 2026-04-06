// src/utils/familyContext.ts

import { FamilyNode, FamilyLink } from '../types/graph';
import { formatNodeDisplayName } from './nodeDisplayName';

export function formatFamilyData(nodes: FamilyNode[], links: FamilyLink[]): string {
  if (!nodes || nodes.length === 0) return 'No family data available.';

  const nodeMap = new Map<string, { displayName: string, cluster: string, parents: string[], spouses: string[], children: string[], siblings: string[] }>();

  // Initialize map
  nodes.forEach(node => {
    nodeMap.set(node.id, {
      displayName: formatNodeDisplayName(node),
      cluster: node.familyCluster || 'Unknown',
      parents: [],
      spouses: [],
      children: [],
      siblings: []
    });
  });

  // Helper to get ID from link source/target
  const getId = (val: any) => typeof val === 'object' ? val.id : val;

  // First pass: Process direct links
  links.forEach(link => {
    const sId = getId(link.source);
    const tId = getId(link.target);
    const s = nodeMap.get(sId);
    const t = nodeMap.get(tId);

    if (s && t) {
      if (link.type === 'parent') {
        t.parents.push(s.displayName);
        s.children.push(t.displayName);
      } else if (link.type === 'marriage') {
        s.spouses.push(t.displayName);
        t.spouses.push(s.displayName);
      }
    }
  });

  // Second pass: Infer spouses as parents and find siblings
  nodes.forEach(node => {
    const data = nodeMap.get(node.id);
    if (!data) return;

    // 1. If a person has a listed parent, and that parent has a spouse, add the spouse as a parent too
    const inferredParents = new Set(data.parents);
    links.forEach(link => {
      if (link.type === 'marriage') {
        const sId = getId(link.source);
        const tId = getId(link.target);
        const s = nodeMap.get(sId);
        const t = nodeMap.get(tId);
        
        if (s && t) {
          if (data.parents.includes(s.displayName)) inferredParents.add(t.displayName);
          if (data.parents.includes(t.displayName)) inferredParents.add(s.displayName);
        }
      }
    });
    data.parents = Array.from(inferredParents);
  });

  // Third pass: Find siblings (people who share at least one parent)
  nodes.forEach(node => {
    const data = nodeMap.get(node.id);
    if (!data || data.parents.length === 0) return;

    nodes.forEach(otherNode => {
      if (node.id === otherNode.id) return;
      const otherData = nodeMap.get(otherNode.id);
      if (!otherData) return;

      const sharedParents = data.parents.filter(p => otherData.parents.includes(p));
      if (sharedParents.length > 0) {
        if (!data.siblings.includes(otherData.displayName)) data.siblings.push(otherData.displayName);
      }
    });
  });

  // Format into a structured text profile for each person
  let context = 'FAMILY PROFILES\n';
  context += '===============\n\n';

  nodeMap.forEach(data => {
    context += `PERSON: ${data.displayName}\n`;
    context += `- Family Cluster: ${data.cluster}\n`;
    if (data.parents.length > 0) context += `- Parents: ${data.parents.join(', ')}\n`;
    if (data.siblings.length > 0) context += `- Siblings: ${data.siblings.join(', ')}\n`;
    if (data.spouses.length > 0) context += `- Spouse: ${data.spouses.join(', ')}\n`;
    if (data.children.length > 0) context += `- Children: ${data.children.join(', ')}\n`;
    context += '\n';
  });

  context += '\nVALID NAMES SUMMARY (FOR VERIFICATION):\n';
  context += nodes.map(n => formatNodeDisplayName(n)).join(', ');
  context += '\n';

  return context;
}
