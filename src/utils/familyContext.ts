// src/utils/familyContext.ts

import { FamilyNode, FamilyLink } from '../types/graph';

export function formatFamilyData(nodes: FamilyNode[], links: FamilyLink[]): string {
  if (!nodes || nodes.length === 0) return 'No family data available.';

  const nodeMap = new Map<string, { name: string, cluster: string, parents: string[], spouses: string[], children: string[], siblings: string[] }>();

  // Initialize map
  nodes.forEach(node => {
    nodeMap.set(node.id, {
      name: node.name,
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
        t.parents.push(s.name);
        s.children.push(t.name);
      } else if (link.type === 'marriage') {
        s.spouses.push(t.name);
        t.spouses.push(s.name);
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
          if (data.parents.includes(s.name)) inferredParents.add(t.name);
          if (data.parents.includes(t.name)) inferredParents.add(s.name);
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
        if (!data.siblings.includes(otherData.name)) data.siblings.push(otherData.name);
      }
    });
  });

  // Format into a structured text profile for each person
  let context = 'FAMILY PROFILES\n';
  context += '===============\n\n';

  nodeMap.forEach(data => {
    context += `PERSON: ${data.name}\n`;
    context += `- Family Cluster: ${data.cluster}\n`;
    if (data.parents.length > 0) context += `- Parents: ${data.parents.join(', ')}\n`;
    if (data.siblings.length > 0) context += `- Siblings: ${data.siblings.join(', ')}\n`;
    if (data.spouses.length > 0) context += `- Spouse: ${data.spouses.join(', ')}\n`;
    if (data.children.length > 0) context += `- Children: ${data.children.join(', ')}\n`;
    context += '\n';
  });

  context += '\nVALID NAMES SUMMARY (FOR VERIFICATION):\n';
  context += nodes.map(n => n.name).join(', ');
  context += '\n';

  return context;
}
