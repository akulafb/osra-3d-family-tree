import { hierarchy, tree, cluster } from 'd3-hierarchy';
import { FamilyNode, FamilyLink, Node2D, Link2D, LayoutType, LayoutConfig } from '../types/graph';

// Default layout configuration
const DEFAULT_CONFIG: LayoutConfig = {
  nodeWidth: 140,
  nodeHeight: 60,
  levelGap: 100,
  siblingGap: 30,
  marriageGap: 20,
};

// Helper to safely get ID from link source/target
function getNodeId(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && 'id' in value) return value.id;
  return null;
}

// Build a hierarchy from flat nodes and links
function buildHierarchy(
  nodes: FamilyNode[],
  links: FamilyLink[],
  clusterName?: string
) {
  // Filter nodes by cluster if specified
  const nodesInScope = clusterName
    ? nodes.filter(n => n.familyCluster === clusterName)
    : nodes;

  const nodeIdsInScope = new Set(nodesInScope.map(n => n.id));

  // Find roots (nodes with no parents in scope)
  const childrenOf = new Map<string, string[]>();
  const parentsOf = new Map<string, string[]>();
  const marriages = new Map<string, string>(); // node -> spouse

  // Initialize maps
  nodesInScope.forEach(n => {
    childrenOf.set(n.id, []);
    parentsOf.set(n.id, []);
  });

  // Process links
  links.forEach(link => {
    const sourceId = getNodeId(link.source);
    const targetId = getNodeId(link.target);

    if (!sourceId || !targetId) return;

    if (link.type === 'parent') {
      const children = childrenOf.get(sourceId) || [];
      children.push(targetId);
      childrenOf.set(sourceId, children);

      const parents = parentsOf.get(targetId) || [];
      parents.push(sourceId);
      parentsOf.set(targetId, parents);
    } else if (link.type === 'marriage' || link.type === 'divorce') {
      marriages.set(sourceId, targetId);
      marriages.set(targetId, sourceId);
    }
  });

  // Find roots (nodes with no parents in scope)
  const roots = nodesInScope.filter(n => {
    const parents = parentsOf.get(n.id) || [];
    return parents.length === 0;
  });

  // If no roots found, use all nodes as separate trees
  const rootNodes = roots.length > 0 ? roots : nodesInScope;

  return {
    rootNodes,
    childrenOf,
    parentsOf,
    marriages,
    nodeIdsInScope,
  };
}

// Convert to d3 hierarchy format with marriage handling
function createHierarchyData(
  rootId: string,
  childrenOf: Map<string, string[]>,
  marriages: Map<string, string>,
  nodes: FamilyNode[],
  visited: Set<string> = new Set()
): any {
  if (visited.has(rootId)) return null;
  visited.add(rootId);

  const node = nodes.find(n => n.id === rootId);
  if (!node) return null;

  const children = (childrenOf.get(rootId) || [])
    .map(childId => createHierarchyData(childId, childrenOf, marriages, nodes, visited))
    .filter(Boolean);

  // Handle spouse and their children
  const spouseId = marriages.get(rootId);
  let spouseChildren: any[] = [];

  if (spouseId && !visited.has(spouseId)) {
    // Get children of spouse that aren't already listed
    const spouseChildIds = (childrenOf.get(spouseId) || [])
      .filter(id => !visited.has(id));

    spouseChildren = spouseChildIds
      .map(childId => createHierarchyData(childId, childrenOf, marriages, nodes, visited))
      .filter(Boolean);
  }

  const allChildren = [...children, ...spouseChildren];

  return {
    id: rootId,
    data: node,
    children: allChildren,
    spouseId,
  };
}

// Calculate tree layout
export function calculateTreeLayout(
  nodes: FamilyNode[],
  links: FamilyLink[],
  clusterName?: string,
  config: Partial<LayoutConfig> = {}
): { nodes: Node2D[]; links: Link2D[] } {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const { rootNodes, childrenOf, marriages } = buildHierarchy(
    nodes,
    links,
    clusterName
  );

  const positionedNodes = new Map<string, Node2D>();
  const positionedLinks: Link2D[] = [];

  let currentX = 0;

  // Process each root as a separate tree
  rootNodes.forEach((rootNode) => {
    const hierarchyData = createHierarchyData(
      rootNode.id,
      childrenOf,
      marriages,
      nodes
    );

    if (!hierarchyData) return;

    // Create d3 hierarchy
    const root = hierarchy(hierarchyData);

    // Apply tree layout
    const treeLayout = tree()
      .nodeSize([
        fullConfig.nodeWidth + fullConfig.siblingGap,
        fullConfig.nodeHeight + fullConfig.levelGap,
      ]);

    treeLayout(root);

    // Extract positions and shift by currentX
    root.descendants().forEach((d: any) => {
      const nodeId = d.data.id;
      const existingNode = positionedNodes.get(nodeId);

      if (!existingNode) {
        const node2D: Node2D = {
          ...d.data.data,
          x: d.x + currentX,
          y: d.depth * (fullConfig.nodeHeight + fullConfig.levelGap),
          width: fullConfig.nodeWidth,
          height: fullConfig.nodeHeight,
          level: d.depth,
        };
        positionedNodes.set(nodeId, node2D);
      }
    });

    // Calculate tree width and update currentX for next tree
    const treeWidth = (root.descendants().length * (fullConfig.nodeWidth + fullConfig.siblingGap));
    currentX += treeWidth + fullConfig.siblingGap * 2;
  });

  // Generate links between positioned nodes
  const nodeArray = Array.from(positionedNodes.values());

  links.forEach(link => {
    const sourceId = getNodeId(link.source);
    const targetId = getNodeId(link.target);

    if (!sourceId || !targetId) return;
    if (!positionedNodes.has(sourceId) || !positionedNodes.has(targetId)) return;

    const source = positionedNodes.get(sourceId)!;
    const target = positionedNodes.get(targetId)!;

    // Generate orthogonal path
    const path = generateOrthogonalPath(source, target, link.type, fullConfig);

    positionedLinks.push({
      source,
      target,
      type: link.type,
      path,
    });
  });

  return {
    nodes: nodeArray,
    links: positionedLinks,
  };
}

// Calculate cluster layout (compact tree)
export function calculateClusterLayout(
  nodes: FamilyNode[],
  links: FamilyLink[],
  clusterName?: string,
  config: Partial<LayoutConfig> = {}
): { nodes: Node2D[]; links: Link2D[] } {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const { rootNodes, childrenOf, marriages } = buildHierarchy(
    nodes,
    links,
    clusterName
  );

  const positionedNodes = new Map<string, Node2D>();
  const positionedLinks: Link2D[] = [];

  let currentX = 0;

  rootNodes.forEach((rootNode) => {
    const hierarchyData = createHierarchyData(
      rootNode.id,
      childrenOf,
      marriages,
      nodes
    );

    if (!hierarchyData) return;

    const root = hierarchy(hierarchyData);

    // Use cluster layout for tighter packing
    const clusterLayout = cluster()
      .nodeSize([
        fullConfig.nodeWidth + fullConfig.siblingGap,
        fullConfig.nodeHeight + fullConfig.levelGap,
      ]);

    clusterLayout(root);

    root.descendants().forEach((d: any) => {
      const nodeId = d.data.id;
      if (!positionedNodes.has(nodeId)) {
        const node2D: Node2D = {
          ...d.data.data,
          x: d.x + currentX,
          y: d.depth * (fullConfig.nodeHeight + fullConfig.levelGap),
          width: fullConfig.nodeWidth,
          height: fullConfig.nodeHeight,
          level: d.depth,
        };
        positionedNodes.set(nodeId, node2D);
      }
    });

    const treeWidth = root.descendants().length * (fullConfig.nodeWidth + fullConfig.siblingGap);
    currentX += treeWidth + fullConfig.siblingGap * 2;
  });

  // Generate links
  const nodeArray = Array.from(positionedNodes.values());

  links.forEach(link => {
    const sourceId = getNodeId(link.source);
    const targetId = getNodeId(link.target);

    if (!sourceId || !targetId) return;
    if (!positionedNodes.has(sourceId) || !positionedNodes.has(targetId)) return;

    const source = positionedNodes.get(sourceId)!;
    const target = positionedNodes.get(targetId)!;
    const path = generateOrthogonalPath(source, target, link.type, fullConfig);

    positionedLinks.push({
      source,
      target,
      type: link.type,
      path,
    });
  });

  return {
    nodes: nodeArray,
    links: positionedLinks,
  };
}

// Calculate radial layout
export function calculateRadialLayout(
  nodes: FamilyNode[],
  links: FamilyLink[],
  clusterName?: string,
  config: Partial<LayoutConfig> = {}
): { nodes: Node2D[]; links: Link2D[] } {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const { rootNodes, childrenOf, marriages } = buildHierarchy(nodes, links, clusterName);

  const positionedNodes = new Map<string, Node2D>();
  const positionedLinks: Link2D[] = [];

  const centerX = 0;
  const centerY = 0;
  const radiusStep = fullConfig.nodeWidth + fullConfig.siblingGap;

  rootNodes.forEach((rootNode) => {
    const hierarchyData = createHierarchyData(
      rootNode.id,
      childrenOf,
      marriages,
      nodes
    );

    if (!hierarchyData) return;

    const root = hierarchy(hierarchyData);

    // Get all descendants for angle distribution
    const descendants = root.descendants();
    const totalNodes = descendants.length;

    descendants.forEach((d: any, index: number) => {
      const nodeId = d.data.id;
      if (!positionedNodes.has(nodeId)) {
        // Distribute nodes evenly in circle based on their index
        const angle = (index / (totalNodes || 1)) * 2 * Math.PI;
        const radius = d.depth * radiusStep;

        const node2D: Node2D = {
          ...d.data.data,
          x: centerX + Math.cos(angle) * radius,
          y: centerY + Math.sin(angle) * radius,
          width: fullConfig.nodeWidth,
          height: fullConfig.nodeHeight,
          level: d.depth,
        };
        positionedNodes.set(nodeId, node2D);
      }
    });
  });

  // Generate links (curved for radial)
  const nodeArray = Array.from(positionedNodes.values());

  links.forEach(link => {
    const sourceId = getNodeId(link.source);
    const targetId = getNodeId(link.target);

    if (!sourceId || !targetId) return;
    if (!positionedNodes.has(sourceId) || !positionedNodes.has(targetId)) return;

    const source = positionedNodes.get(sourceId)!;
    const target = positionedNodes.get(targetId)!;

    // Curved path for radial layout
    const path = generateCurvedPath(source, target);

    positionedLinks.push({
      source,
      target,
      type: link.type,
      path,
    });
  });

  return {
    nodes: nodeArray,
    links: positionedLinks,
  };
}

// Generate orthogonal (elbow) path
function generateOrthogonalPath(
  source: Node2D,
  target: Node2D,
  type: 'parent' | 'marriage' | 'divorce',
  _config: LayoutConfig
): string {
  if (type === 'marriage' || type === 'divorce') {
    // Horizontal connection between spouses
    const sourceRight = source.x + source.width / 2;
    const targetLeft = target.x - target.width / 2;
    const y = source.y + source.height / 2;

    return `M ${sourceRight} ${y} L ${targetLeft} ${y}`;
  }

  // Parent-child: vertical with elbow
  const sourceBottom = source.y + source.height;
  const targetTop = target.y;
  const sourceX = source.x;
  const targetX = target.x;

  const midY = (sourceBottom + targetTop) / 2;

  return `M ${sourceX} ${sourceBottom} L ${sourceX} ${midY} L ${targetX} ${midY} L ${targetX} ${targetTop}`;
}

// Generate curved path for radial layout
function generateCurvedPath(source: Node2D, target: Node2D): string {
  const sx = source.x + source.width / 2;
  const sy = source.y + source.height / 2;
  const tx = target.x + target.width / 2;
  const ty = target.y + target.height / 2;

  // Simple quadratic curve
  const midX = (sx + tx) / 2;
  const midY = (sy + ty) / 2;

  return `M ${sx} ${sy} Q ${midX} ${midY} ${tx} ${ty}`;
}

// Main layout calculation function
export function calculateLayout(
  nodes: FamilyNode[],
  links: FamilyLink[],
  layoutType: LayoutType,
  clusterName?: string,
  config?: Partial<LayoutConfig>
): { nodes: Node2D[]; links: Link2D[] } {
  switch (layoutType) {
    case 'tree':
      return calculateTreeLayout(nodes, links, clusterName, config);
    case 'cluster':
      return calculateClusterLayout(nodes, links, clusterName, config);
    case 'radial':
      return calculateRadialLayout(nodes, links, clusterName, config);
    default:
      return calculateTreeLayout(nodes, links, clusterName, config);
  }
}

// Calculate bounds for a set of positioned nodes
export function calculateBounds(nodes: Node2D[]): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
} {
  if (nodes.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  nodes.forEach(node => {
    minX = Math.min(minX, node.x - node.width / 2);
    maxX = Math.max(maxX, node.x + node.width / 2);
    minY = Math.min(minY, node.y);
    maxY = Math.max(maxY, node.y + node.height);
  });

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}
