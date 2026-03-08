import type { FamilyGraph, FamilyLink } from '../types/graph';
import { getNodeId } from '../utils/getNodeId';

/**
 * Filter graph data by preset (cluster) and collapsed nodes.
 * Used by 2D view and by FamilyTree for search scope.
 */
export function filterGraphData(
  graphData: FamilyGraph,
  collapsedNodes: Set<string>,
  activePreset?: string | null
): FamilyGraph {
  let nodes = graphData.nodes;
  let links = graphData.links;

  const getLinkKey = (sourceId: string, targetId: string, type: string) =>
    `${sourceId}|${targetId}|${type}`;

  if (activePreset) {
    nodes = nodes.filter(
      (n) => n.familyCluster === activePreset || n.maternalFamilyCluster === activePreset
    );
    const nodeIds = new Set(nodes.map((n) => n.id));
    const visibleLinkKeys = new Set<string>();

    links = links.filter((l) => {
      const sourceId = getNodeId(l.source);
      const targetId = getNodeId(l.target);
      if (!nodeIds.has(sourceId) || !nodeIds.has(targetId)) return false;

      const key = getLinkKey(sourceId, targetId, l.type);
      if (visibleLinkKeys.has(key)) return false;
      visibleLinkKeys.add(key);
      return true;
    });

    const maternalOnlyIds = new Set(
      nodes
        .filter((n) => n.maternalFamilyCluster === activePreset && n.familyCluster !== activePreset)
        .map((n) => n.id)
    );
    const marriageByNode = new Map<string, string>();
    graphData.links.forEach((l) => {
      if (l.type === 'marriage') {
        const a = getNodeId(l.source);
        const b = getNodeId(l.target);
        if (a && b) {
          marriageByNode.set(a, b);
          marriageByNode.set(b, a);
        }
      }
    });
    graphData.links.forEach((l) => {
      if (l.type !== 'parent') return;
      const fatherId = getNodeId(l.source);
      const childId = getNodeId(l.target);
      if (!fatherId || !childId || !maternalOnlyIds.has(childId)) return;
      if (nodeIds.has(fatherId)) return;
      const motherId = marriageByNode.get(fatherId);
      if (motherId && nodeIds.has(motherId)) {
        const key = getLinkKey(motherId, childId, 'parent');
        if (!visibleLinkKeys.has(key)) {
          visibleLinkKeys.add(key);
          links.push({ source: motherId, target: childId, type: 'parent' });
        }
      }
    });
  }

  if (collapsedNodes.size === 0) return { nodes, links };

  const hiddenNodes = new Set<string>();

  const getDescendants = (nodeId: string): string[] => {
    const descendants: string[] = [];
    const queue = [nodeId];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const children = links
        .filter((l) => {
          const sourceId = getNodeId(l.source);
          return sourceId === currentId && l.type === 'parent';
        })
        .map((l) => getNodeId(l.target));

      descendants.push(...children);
      queue.push(...children);
    }

    return descendants;
  };

  collapsedNodes.forEach((id) => {
    getDescendants(id).forEach((dId) => hiddenNodes.add(dId));
  });

  return {
    nodes: nodes.filter((n) => !hiddenNodes.has(n.id)),
    links: links.filter((l) => {
      const sourceId = getNodeId(l.source);
      const targetId = getNodeId(l.target);
      return !hiddenNodes.has(sourceId) && !hiddenNodes.has(targetId);
    }),
  };
}

/**
 * Get visible nodes for 3D view (filtered by collapsed only; no preset).
 */
export function getVisibleNodes3D(
  graphData: FamilyGraph,
  collapsedNodes: Set<string>
): FamilyGraph['nodes'] {
  if (!graphData?.nodes) return [];

  const hiddenNodes = new Set<string>();
  const links = graphData.links as FamilyLink[];

  const getDescendantIds = (nodeId: string): string[] => {
    const descendants: string[] = [];
    const queue = [nodeId];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const children = links
        .filter((l) => getNodeId(l.source) === currentId && l.type === 'parent')
        .map((l) => getNodeId(l.target));

      descendants.push(...children);
      queue.push(...children);
    }
    return descendants;
  };

  collapsedNodes.forEach((id) => {
    getDescendantIds(id).forEach((dId) => hiddenNodes.add(dId));
  });

  return graphData.nodes.filter((n) => !hiddenNodes.has(n.id));
}
