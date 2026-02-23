// src/components/FamilyTree3D.tsx

import React, { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import SpriteText from 'three-spritetext';
import * as THREE from 'three';
import { FamilyGraph, FamilyNode } from '../types/graph';
import { useAuth } from '../contexts/AuthContext';
import { FamilyLink } from '../lib/permissions';
import { createStarfield, type NebulaData } from '../utils/starfield';

// V3 Shared Assets
const planetTextures = [
  '/planet-textures/earth.jpg',
  '/planet-textures/jupiter.jpg',
  '/planet-textures/mars.jpg',
  '/planet-textures/mercury.jpg',
  '/planet-textures/neptune.jpg',
  '/planet-textures/saturn.jpg',
  '/planet-textures/uranus.jpg',
  '/planet-textures/venus.jpg',
  '/planet-textures/sun.jpg',
  '/planet-textures/Moon Texture.jpg',
  '/planet-textures/Ceres Fictional Texture.jpg',
  '/planet-textures/Eris Fictional Texture.jpg',
  '/planet-textures/Haumea Texture.jpg',
  '/planet-textures/Makemake Texture.jpg',
  '/planet-textures/Gemini Fictional.png'
];

const textureLoader = new THREE.TextureLoader();
const planetMaterialCache = new Map<string, THREE.MeshPhysicalMaterial>();

const getPlanetMaterial = (nodeId: string) => {
  let hash = 0;
  for (let i = 0; i < nodeId.length; i++) {
    hash = nodeId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const texturePath = planetTextures[Math.abs(hash) % planetTextures.length];

  if (!planetMaterialCache.has(texturePath)) {
    const texture = textureLoader.load(texturePath);
    texture.colorSpace = THREE.SRGBColorSpace;
    
    planetMaterialCache.set(texturePath, new THREE.MeshPhysicalMaterial({
      map: texture,
      roughness: 0.8,
      metalness: 0.1,
      clearcoat: 0.3,
      clearcoatRoughness: 0.2,
      transmission: 0,
      thickness: 0,
      side: THREE.FrontSide
    }));
  }
  return planetMaterialCache.get(texturePath)!;
};

const materialCache = new Map<string, THREE.MeshPhysicalMaterial>();
const getMaterial = (color: string) => {
  if (!materialCache.has(color)) {
    materialCache.set(color, new THREE.MeshPhysicalMaterial({
      color,
      transparent: true,
      opacity: 0.4,
      roughness: 0.8,
      metalness: 0.2,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      transmission: 0.3,
      thickness: 2,
      side: THREE.DoubleSide
    }));
  }
  return materialCache.get(color)!;
};

const familyColors: Record<string, string> = {
  'Badran': '#0066ff',
  'Kutob': '#00ff88',
  'Hajjaj': '#ffaa00',
  'Zabalawi': '#ff00aa',
  'Malhis': '#aa00ff',
  'Shawa': '#ff3333',
  'Dajani': '#33ffff',
  'Masri': '#ffff33',
  'Tamimi': '#00ff00',
  'Husaini': '#ff0000',
  'Nabulsi': '#ff6600',
  'Ghazali': '#00ccff',
  'Rifai': '#cc00ff',
  'Qudsi': '#66ff00',
  'Jaabari': '#ff0066',
  'Khalidi': '#00ffcc',
};

const getClusterColor = (cluster: string | undefined | null) => {
  if (!cluster) return '#ffffff';
  if (familyColors[cluster]) return familyColors[cluster];
  
  const colors = Object.values(familyColors);
  let hash = 0;
  for (let i = 0; i < cluster.length; i++) {
    hash = cluster.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const getNodeId = (nodeOrId: any): string => {
  if (!nodeOrId) return '';
  if (typeof nodeOrId === 'object') {
    return nodeOrId.id || '';
  }
  return String(nodeOrId);
};

const getDescendantIds = (nodeId: string, links: FamilyLink[]): string[] => {
  const descendants: string[] = [];
  const queue = [nodeId];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const children = links
      .filter(l => {
        const sourceId = getNodeId(l.source);
        return sourceId === currentId && l.type === 'parent';
      })
      .map(l => getNodeId(l.target));

    descendants.push(...children);
    queue.push(...children);
  }
  return descendants;
};

// Props interface for the refactored component
interface FamilyTree3DProps {
  graphData: FamilyGraph;
  selectedNode: FamilyNode | null;
  onNodeSelect: (node: FamilyNode) => void;
  onBackgroundClick?: () => void;
  collapsedNodes?: Set<string>;
  onToggleCollapse?: (nodeId: string) => void;
  onSetCollapsedNodes?: (nodes: Set<string>) => void;
  onModeChange?: (mode: '3D' | '2D') => void;
  isAddModalOpen?: boolean;
  isEditModalOpen?: boolean;
  isBulkInviteOpen?: boolean;
}

export const FamilyTree3DContent: React.FC<FamilyTree3DProps> = ({
  graphData,
  selectedNode,
  onNodeSelect,
  onBackgroundClick,
  collapsedNodes: externalCollapsedNodes,
  onToggleCollapse: externalToggleCollapse,
  onSetCollapsedNodes: externalSetCollapsedNodes,
  onModeChange,
  isAddModalOpen = false,
  isEditModalOpen = false,
  isBulkInviteOpen = false,
}) => {
  const ForceGraph3DAny = ForceGraph3D as unknown as React.ComponentType<any>;
  const { userProfile } = useAuth();

  const geometries = useMemo(() => ({
    sphere: new THREE.SphereGeometry(10, 16, 16),
    aura: new THREE.SphereGeometry(18, 12, 12),
    glow: new THREE.SphereGeometry(22, 12, 12)
  }), []);

  const fgRef = useRef<any>();
  const starfieldRef = useRef<THREE.Group | null>(null);
  const nebulaeRef = useRef<NebulaData[]>([]);
  const hasIntroPlayed = useRef(false);
  const rotationRef = useRef(0);

  // Internal state for modals
  const [initialCameraPos, setInitialCameraPos] = useState<{ x: number; y: number; z: number } | null>(null);
  const [isSimulationLoading, setIsSimulationLoading] = useState(true);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  // V3 Features: Toggles
  const [showNames, setShowNames] = useState(true);
  const [showLinks, setShowLinks] = useState(true);
  const [showControls, setShowControls] = useState(false);
  const [nodeTexture, setNodeTexture] = useState<'spheres' | 'planets' | 'none'>('spheres');
  const [showArrows, setShowArrows] = useState(false);
  const [isPresetsOpen, setIsPresetsOpen] = useState(false);
  const presetsRef = useRef<HTMLDivElement>(null);
  const textureRef = useRef<HTMLDivElement>(null);
  const [isTextureMenuOpen, setIsTextureMenuOpen] = useState(false);
  const [isAmbienceOn, setIsAmbienceOn] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [showNavControls, setShowNavControls] = useState(false);

  // Navigation state for WASD/Mouse Steering
  const [isSteeringActive, setIsSteeringActive] = useState(false);
  const keysPressed = useRef<Record<string, boolean>>({});
  const mousePos = useRef({ x: 0, y: 0 });
  const isMouseInWindow = useRef(true);

  // Audio controller
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio('/audio/Cosmic Ambience Sound Effect.mp3');
      audioRef.current.loop = true;
      audioRef.current.volume = 0.25;
    }

    const playAudio = () => {
      if (isAmbienceOn && audioRef.current) {
        audioRef.current.play().catch(err => {
          console.warn('[Ambience] Autoplay blocked:', err);
        });
      }
    };

    if (isAmbienceOn) {
      playAudio();
      window.addEventListener('click', playAudio, { once: true });
    } else {
      audioRef.current?.pause();
    }

    return () => {
      audioRef.current?.pause();
      window.removeEventListener('click', playAudio);
    };
  }, [isAmbienceOn]);

  // Get unique clusters for presets
  const uniqueClusters = React.useMemo(() => {
    if (!graphData?.nodes) return [];
    const clusters = new Set<string>();
    graphData.nodes.forEach(n => { if (n.familyCluster) clusters.add(n.familyCluster); });
    return Array.from(clusters).sort();
  }, [graphData]);

  // Use external collapsed nodes if provided
  const effectiveCollapsedNodes = externalCollapsedNodes || new Set();
  const effectiveSetCollapsedNodes = externalSetCollapsedNodes || (() => {});
  const effectiveToggleCollapse = externalToggleCollapse || (() => {});

  const filteredGraphData = useMemo(() => {
    try {
      if (!graphData) return { nodes: [], links: [] };

      const hiddenNodes = new Set<string>();
      effectiveCollapsedNodes.forEach(id => {
        const descendants = getDescendantIds(id, graphData.links as FamilyLink[]);
        descendants.forEach(dId => hiddenNodes.add(dId));
      });

      const filtered = {
        nodes: graphData.nodes.filter(n => !hiddenNodes.has(n.id)),
        links: (graphData.links as any[]).filter(l => {
          const sourceId = getNodeId(l.source);
          const targetId = getNodeId(l.target);
          return !hiddenNodes.has(sourceId) && !hiddenNodes.has(targetId);
        })
      };
      return filtered;
    } catch (err) {
      console.error('[FamilyTree3D] Error filtering graph data:', err);
      return { nodes: [], links: [] };
    }
  }, [graphData, effectiveCollapsedNodes]);

  // Focus Logic
  const handleNodeClick = useCallback((node: FamilyNode) => {
    if (!fgRef.current) return;
    
    const nodeData = node as any;
    onNodeSelect(node);
    
    const x = (typeof nodeData.x === 'number' && !isNaN(nodeData.x)) ? nodeData.x : 0;
    const y = (typeof nodeData.y === 'number' && !isNaN(nodeData.y)) ? nodeData.y : 0;
    const z = (typeof nodeData.z === 'number' && !isNaN(nodeData.z)) ? nodeData.z : 0;
    
    const nodePos = { x, y, z };
    const distance = 120;
    
    const camera = fgRef.current.camera();
    const currentPos = camera.position;
    
    let direction = new THREE.Vector3(currentPos.x - x, currentPos.y - y, currentPos.z - z);
    if (isNaN(direction.x) || isNaN(direction.y) || isNaN(direction.z) || direction.lengthSq() < 0.0001) {
      direction.set(0, 0, 1);
    } else {
      direction.normalize();
    }
    
    const targetPos = {
      x: x + direction.x * distance,
      y: y + direction.y * distance,
      z: z + direction.z * distance
    };

    fgRef.current.cameraPosition(targetPos, nodePos, 800);
  }, [onNodeSelect]);

  // Reset View functionality
  const resetView = useCallback(() => {
    if (!fgRef.current || !initialCameraPos || !graphData) return;
    
    // Clear all fixed positions
    graphData.nodes.forEach((node: any) => {
      node.fx = undefined;
      node.fy = undefined;
      node.fz = undefined;
    });
    fgRef.current.d3ReheatSimulation();

    const camera = fgRef.current.camera();
    const controls = fgRef.current.controls();
    if (!camera || !controls) return;
    
    setActivePreset(null);
    onBackgroundClick?.();

    const duration = 1500;
    const startTime = Date.now();
    const startPos = camera.position.clone();
    const startTarget = controls.target.clone();

    const animate = () => {
      const progress = Math.min((Date.now() - startTime) / duration, 1);
      const eased = progress < 0.5 
        ? 2 * progress * progress 
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      camera.position.lerpVectors(
        startPos, 
        new THREE.Vector3(initialCameraPos.x, initialCameraPos.y, initialCameraPos.z), 
        eased
      );
      
      controls.target.lerpVectors(
        startTarget, 
        new THREE.Vector3(0, 0, 0), 
        eased
      );
      
      camera.lookAt(controls.target);
      camera.updateProjectionMatrix();

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    animate();
  }, [initialCameraPos, graphData, onBackgroundClick]);

  // Preset Focus Logic
  const focusNodeById = useCallback((nodeId: string) => {
    const node = graphData?.nodes?.find(n => n.id === nodeId);
    if (node) handleNodeClick(node);
  }, [graphData, handleNodeClick]);

  const calculateGenerationLevels = useCallback((clusterName: string) => {
    if (!graphData) return new Map<string, number>();

    const nodesInCluster = graphData.nodes.filter(n => n.familyCluster === clusterName);
    const clusterNodeIds = new Set(nodesInCluster.map(n => n.id));
    
    const getSafeId = (val: any) => {
      if (!val) return null;
      if (typeof val === 'string') return val;
      if (typeof val === 'object' && val.id) return val.id;
      return null;
    };

    const roots = nodesInCluster.filter(node => {
      const hasParentInCluster = graphData.links.some(link => {
        const s = getSafeId(link.source);
        const t = getSafeId(link.target);
        return t === node.id && link.type === 'parent' && clusterNodeIds.has(s || '');
      });
      return !hasParentInCluster;
    });

    const levels = new Map<string, number>();
    const queue: { id: string; level: number }[] = [];

    roots.forEach(r => {
      levels.set(r.id, 0);
      queue.push({ id: r.id, level: 0 });
    });

    let head = 0;
    while (head < queue.length) {
      const { id, level } = queue[head++];

      graphData.links.forEach(link => {
        const s = getSafeId(link.source);
        const t = getSafeId(link.target);

        if (s === id && t && clusterNodeIds.has(t)) {
          if (!levels.has(t)) {
            const nextLevel = link.type === 'parent' ? level + 1 : level;
            levels.set(t, nextLevel);
            queue.push({ id: t, level: nextLevel });
          }
        } else if (t === id && s && clusterNodeIds.has(s)) {
          if (!levels.has(s)) {
            const nextLevel = link.type === 'marriage' ? level : level - 1;
            if (link.type === 'marriage') {
              levels.set(s, nextLevel);
              queue.push({ id: s, level: nextLevel });
            }
          }
        }
      });
    }
    
    nodesInCluster.forEach(n => {
      if (!levels.has(n.id)) levels.set(n.id, 0);
    });

    return levels;
  }, [graphData]);

  const applyPreset = useCallback((clusterName: string | null | 'me') => {
    setIsPresetsOpen(false);
    if (!fgRef.current || !graphData) return;

    if (!clusterName) {
      resetView();
      return;
    }

    if (clusterName === 'me') {
      if (userProfile?.node_id) {
        focusNodeById(userProfile.node_id);
      }
      return;
    }

    setActivePreset(clusterName);
    const levels = calculateGenerationLevels(clusterName);
    const generationHeight = 250; // Increased for better vertical clarity
    const horizontalSpread = 220; // Increased slightly from 180 for better legibility

    const nodesInCluster = graphData.nodes.filter(n => n.familyCluster === clusterName);
    const clusterNodeIds = new Set(nodesInCluster.map(n => n.id));

    // 1. Build adjacency list for children in this cluster
    const childrenMap = new Map<string, string[]>();
    graphData.links.forEach(link => {
      if (link.type === 'parent') {
        const s = typeof link.source === 'object' ? (link.source as any).id : link.source;
        const t = typeof link.target === 'object' ? (link.target as any).id : link.target;
        if (clusterNodeIds.has(s) && clusterNodeIds.has(t)) {
          const list = childrenMap.get(s) || [];
          list.push(t);
          childrenMap.set(s, list);
        }
      }
    });

    // 2. Calculate subtree widths (number of leaf nodes in the subtree)
    const subtreeWidths = new Map<string, number>();
    const getSubtreeWidth = (id: string): number => {
      const children = childrenMap.get(id) || [];
      if (children.length === 0) {
        subtreeWidths.set(id, 1);
        return 1;
      }
      const width = children.reduce((sum, childId) => sum + getSubtreeWidth(childId), 0);
      subtreeWidths.set(id, width);
      return width;
    };

    // 3. Find roots (nodes with no parents in the cluster)
    const roots = nodesInCluster.filter(node => {
      const hasParentInCluster = graphData.links.some(link => {
        const t = typeof link.target === 'object' ? (link.target as any).id : link.target;
        const s = typeof link.source === 'object' ? (link.source as any).id : link.source;
        return t === node.id && link.type === 'parent' && clusterNodeIds.has(s);
      });
      return !hasParentInCluster;
    });

    // Calculate total width for the entire cluster
    let totalClusterWidth = 0;
    roots.forEach(root => {
      totalClusterWidth += getSubtreeWidth(root.id);
    });

    // 4. Recursive positioning: children are centered under their parent's territory
    const positionNode = (id: string, leftX: number, width: number, level: number) => {
      const node = graphData.nodes.find(n => n.id === id);
      if (!node) return;

      const centerX = leftX + (width * horizontalSpread) / 2;
      const centerY = level * generationHeight;

      (node as any).fx = centerX;
      (node as any).fy = centerY;
      (node as any).fz = 0;
      (node as any).x = centerX;
      (node as any).y = centerY;
      (node as any).z = 0;

      const children = childrenMap.get(id) || [];
      let currentLeft = leftX;
      children.forEach(childId => {
        const childWidth = subtreeWidths.get(childId) || 1;
        positionNode(childId, currentLeft, childWidth, level + 1);
        currentLeft += childWidth * horizontalSpread;
      });
    };

    // Position roots evenly
    let currentRootLeft = -(totalClusterWidth * horizontalSpread) / 2;
    roots.forEach(root => {
      const rootWidth = subtreeWidths.get(root.id) || 1;
      positionNode(root.id, currentRootLeft, rootWidth, levels.get(root.id) || 0);
      currentRootLeft += rootWidth * horizontalSpread;
    });

    // Push non-cluster nodes back, but stagger those connected to the cluster (including their local branches)
    const processedNonClusterNodes = new Set<string>();
    
    // 1. Identify "bridge nodes" - non-cluster nodes directly connected to the active cluster
    const bridgeNodes: { node: any, anchorNode: any }[] = [];
    graphData.nodes.forEach((node: any) => {
      if (node.familyCluster !== clusterName) {
        const connection = graphData.links.find(l => {
          const sId = getNodeId(l.source);
          const tId = getNodeId(l.target);
          if (sId === node.id && clusterNodeIds.has(tId)) return true;
          if (tId === node.id && clusterNodeIds.has(sId)) return true;
          return false;
        });

        if (connection) {
          const anchorId = clusterNodeIds.has(getNodeId(connection.source)) 
            ? getNodeId(connection.source) 
            : getNodeId(connection.target);
          const anchorNode = graphData.nodes.find(n => n.id === anchorId) as any;
          if (anchorNode && typeof anchorNode.fx === 'number') {
            bridgeNodes.push({ node, anchorNode });
          }
        }
      }
    });

    // 2. For each bridge node, find its local branch of other non-cluster nodes and position them together
    const anchorCounters = new Map<string, number>();
    
    bridgeNodes.forEach(({ node, anchorNode }) => {
      if (processedNonClusterNodes.has(node.id)) return;

      // BFS to find the connected local branch of non-cluster nodes
      const localBranch: any[] = [];
      const queue = [node.id];
      const visitedInBFS = new Set<string>([node.id]);

      while (queue.length > 0) {
        const currentId = queue.shift()!;
        const currentNode = graphData.nodes.find(n => n.id === currentId);
        if (currentNode) localBranch.push(currentNode);
        processedNonClusterNodes.add(currentId);

        graphData.links.forEach(l => {
          const sId = getNodeId(l.source);
          const tId = getNodeId(l.target);
          let neighborId = null;
          if (sId === currentId) neighborId = tId;
          else if (tId === currentId) neighborId = sId;

          if (neighborId && !visitedInBFS.has(neighborId)) {
            const neighborNode = graphData.nodes.find(n => n.id === neighborId);
            // Only traverse into other non-cluster nodes
            if (neighborNode && neighborNode.familyCluster !== clusterName) {
              visitedInBFS.add(neighborId);
              queue.push(neighborId);
            }
          }
        });
      }

      // Position the entire local branch behind the anchor
      const anchorId = anchorNode.id;
      localBranch.forEach((branchNode, index) => {
        const count = (anchorCounters.get(anchorId) || 0) + 1;
        anchorCounters.set(anchorId, count);

        // All nodes in this branch share the anchor's X/Y region
        // but are spread out slightly in X/Y and staggered in Z
        const staggerZ = -300 - (count * 200);
        // Add a small spiral/circular spread in X/Y so they aren't perfectly linear
        const angle = index * 0.5;
        const radius = 40 + (index * 15);
        const offsetX = Math.cos(angle) * radius;
        const offsetY = Math.sin(angle) * radius;

        branchNode.fx = anchorNode.fx + offsetX;
        branchNode.fy = anchorNode.fy + offsetY;
        branchNode.fz = staggerZ;
        branchNode.x = anchorNode.fx + offsetX;
        branchNode.y = anchorNode.fy + offsetY;
        branchNode.z = staggerZ;
      });
    });

    // 3. Default background position for any remaining unconnected non-cluster nodes
    graphData.nodes.forEach((node: any) => {
      if (node.familyCluster !== clusterName && !processedNonClusterNodes.has(node.id)) {
        const safeX = (typeof node.x === 'number' && !isNaN(node.x)) ? node.x : (Math.random() - 0.5) * 2000;
        const safeY = (typeof node.y === 'number' && !isNaN(node.y)) ? node.y : (Math.random() - 0.5) * 2000;
        node.fx = safeX;
        node.fy = safeY;
        node.fz = -1500; // Push even further back
        node.x = safeX;
        node.y = safeY;
        node.z = -1500;
      }
    });

    fgRef.current.d3ReheatSimulation();

    // Find a good representative for the cluster
    const rep = (clusterName === 'Badran') 
      ? graphData.nodes.find(n => n.name === 'Basel Badran')
      : graphData.nodes.find(n => n.familyCluster === clusterName);
    
    if (rep) focusNodeById(rep.id);
  }, [graphData, calculateGenerationLevels, resetView, focusNodeById, userProfile]);

  // Navigation Flight Loop (WASD + Mouse Steering)
  useEffect(() => {
    let frameId: number;
    const baseSpeed = 1.2;
    const boostMultiplier = 4.0;
    const turnSpeed = 0.012;
    const deadzone = 0.15;

    const update = () => {
      if (fgRef.current && 
          !isAddModalOpen && !isEditModalOpen && !isBulkInviteOpen && 
          document.activeElement?.tagName !== 'INPUT' && 
          document.activeElement?.tagName !== 'TEXTAREA') {
        
        const camera = fgRef.current.camera();
        const controls = fgRef.current.controls();
        
        if (camera && controls) {
          // 1. Steering (Mouse Look)
          if (isSteeringActive && isMouseInWindow.current) {
            const dx = mousePos.current.x;
            const dy = mousePos.current.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist > deadzone) {
              const normalizedDist = (dist - deadzone) / (1 - deadzone);
              const factor = Math.pow(normalizedDist, 4) * turnSpeed;
              const yaw = -dx * factor;
              const pitch = dy * factor;
              
              const direction = new THREE.Vector3().subVectors(controls.target, camera.position);
              const right = new THREE.Vector3().crossVectors(direction, camera.up).normalize();
              const upProj = direction.clone().normalize().dot(camera.up);
              const canPitch = (pitch > 0 && upProj < 0.92) || (pitch < 0 && upProj > -0.92);

              direction.applyAxisAngle(camera.up, yaw);
              if (canPitch) direction.applyAxisAngle(right, pitch);
              controls.target.addVectors(camera.position, direction);
            }
          }

          // 3. Keyboard Roll (Q/E)
          let kbRoll = 0;
          if (keysPressed.current['q']) kbRoll -= turnSpeed;
          if (keysPressed.current['e']) kbRoll += turnSpeed;

          if (kbRoll !== 0) {
            const forward = new THREE.Vector3();
            camera.getWorldDirection(forward);
            camera.up.applyAxisAngle(forward, kbRoll);
          }

          // 2. Thrust/Strafe (WASD)
          const moveSpeed = keysPressed.current['shift'] ? baseSpeed * boostMultiplier : baseSpeed;
          const forward = new THREE.Vector3();
          camera.getWorldDirection(forward);
          const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
          const moveVec = new THREE.Vector3(0, 0, 0);

          if (keysPressed.current['w'] || keysPressed.current['arrowup']) moveVec.add(forward);
          if (keysPressed.current['s'] || keysPressed.current['arrowdown']) moveVec.add(forward.clone().negate());
          if (keysPressed.current['a'] || keysPressed.current['arrowleft']) moveVec.add(right.clone().negate());
          if (keysPressed.current['d'] || keysPressed.current['arrowright']) moveVec.add(right);

          if (moveVec.lengthSq() > 0) {
            moveVec.normalize().multiplyScalar(moveSpeed);
            camera.position.add(moveVec);
            controls.target.add(moveVec);
          }
          
          controls.update();
          camera.updateProjectionMatrix();
        }
      }
      frameId = requestAnimationFrame(update);
    };

    frameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frameId);
  }, [isAddModalOpen, isEditModalOpen, isBulkInviteOpen, isSteeringActive]);

  // Event Listeners for Navigation
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keysPressed.current[key] = true;
      
      // Prevent navigation shortcuts when typing
      if (isAddModalOpen || isEditModalOpen || isBulkInviteOpen || 
          document.activeElement?.tagName === 'INPUT' || 
          document.activeElement?.tagName === 'TEXTAREA') return;
      
      if (key === 'r') {
        setIsSteeringActive(prev => !prev);
      } else if (key === 'tab') {
        e.preventDefault();
        if (graphData?.nodes?.length) {
          const idx = selectedNode ? graphData.nodes.findIndex(n => n.id === selectedNode.id) : -1;
          const next = e.shiftKey 
            ? (idx <= 0 ? graphData.nodes.length - 1 : idx - 1) 
            : (idx + 1) % graphData.nodes.length;
          handleNodeClick(graphData.nodes[next]);
        }
      } else if (key === 'enter' || key === ' ') {
        if (selectedNode) {
          e.preventDefault();
          handleNodeClick(selectedNode);
        }
      } else if (key === 'escape') {
        if (selectedNode) {
          e.preventDefault();
          onBackgroundClick?.();
        }
      }
    };

    const onUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = false;
    };

    const onMove = (e: MouseEvent) => {
      mousePos.current = {
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: -((e.clientY / window.innerHeight) * 2 - 1)
      };
    };

    const onOut = () => { isMouseInWindow.current = false; };
    const onIn = () => { isMouseInWindow.current = true; };

    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseleave', onOut);
    window.addEventListener('mouseenter', onIn);
    
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseleave', onOut);
      window.removeEventListener('mouseenter', onIn);
    };
  }, [graphData, selectedNode, handleNodeClick, isAddModalOpen, isEditModalOpen, isBulkInviteOpen]);

  // Node UI
  const nodeThreeObject = useCallback((node: FamilyNode) => {
    try {
      const isSelected = selectedNode?.id === node.id;
      const color = getClusterColor(node.familyCluster);
      const group = new THREE.Group();

      if (nodeTexture !== 'none') {
        const material = nodeTexture === 'planets' ? getPlanetMaterial(node.id) : getMaterial(color);
        const sphere = new THREE.Mesh(geometries.sphere, material);
        group.add(sphere);

        const speedFactor = 0.5 + Math.random() * 0.5;
        sphere.onBeforeRender = () => {
          const rot = rotationRef.current * speedFactor;
          sphere.rotation.y = rot;
          sphere.rotation.z = rot * 0.5;
        };

        if (isSelected) {
          const aura = new THREE.Mesh(geometries.aura, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.2, wireframe: true }));
          const glow = new THREE.Mesh(geometries.glow, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.05 }));
          group.add(aura);
          group.add(glow);
        }
      }

      if (showNames) {
        const fullName = node.name || 'Unknown';
        const nameParts = fullName.trim().split(' ');
        let displayName = fullName;
        
        if (nameParts.length > 1) {
          const firstName = nameParts.slice(0, -1).join(' ');
          const lastName = nameParts[nameParts.length - 1];
          displayName = `${firstName}\n${lastName}`;
        }

        const sprite = new SpriteText(displayName);
        sprite.color = '#ffffff';
        sprite.textHeight = 4;
        sprite.fontWeight = 'bold';
        sprite.position.set(0, 0, 0);
        sprite.renderOrder = 999;
        sprite.material.depthTest = false;
        group.add(sprite);
      }

      return group;
    } catch (err) {
      console.error('[FamilyTree3D] Error in nodeThreeObject:', err);
      return new THREE.Group();
    }
  }, [selectedNode, showNames, nodeTexture, geometries, rotationRef]);

  const linkThreeObject = useCallback((link: any) => {
    if (activePreset && link.type === 'parent') {
      const sourceCluster = typeof link.source === 'object' ? link.source.familyCluster : null;
      const targetCluster = typeof link.target === 'object' ? link.target.familyCluster : null;
      
      if (sourceCluster === activePreset && targetCluster === activePreset) {
        const geometry = new THREE.BufferGeometry();
        const material = new THREE.LineBasicMaterial({ color: '#60a5fa' });
        const line = new THREE.Line(geometry, material);
        return line;
      }
    }
    return null;
  }, [activePreset]);

  const linkPositionUpdate = useCallback((line: any, { start, end }: any, link: any) => {
    if (activePreset && link.type === 'parent' && line instanceof THREE.Line) {
      const sourceCluster = typeof link.source === 'object' ? link.source.familyCluster : null;
      const targetCluster = typeof link.target === 'object' ? link.target.familyCluster : null;

      if (sourceCluster === activePreset && targetCluster === activePreset) {
        const sourceId = typeof link.source === 'object' && link.source !== null ? (link.source as any).id : link.source;
        let hash = 0;
        const idStr = String(sourceId);
        for (let i = 0; i < idStr.length; i++) {
          hash = ((hash << 5) - hash) + idStr.charCodeAt(i);
          hash |= 0;
        }
        const staggerOffset = (Math.abs(hash) % 20) - 10;
        
        const midY = (start.y + end.y) / 2 + staggerOffset;
        const points = [
          new THREE.Vector3(start.x, start.y, start.z),
          new THREE.Vector3(start.x, midY, start.z),
          new THREE.Vector3(end.x, midY, end.z),
          new THREE.Vector3(end.x, end.y, end.z)
        ];
        line.geometry.setFromPoints(points);
        return true;
      }
    }
    return false;
  }, [activePreset]);

  useEffect(() => {
    if (fgRef.current && !initialCameraPos) {
      const camera = fgRef.current.camera();
      if (camera) {
        camera.position.set(0, 0, 30000);
        setInitialCameraPos({ x: 0, y: 0, z: 650 });
      }
    }
  }, [initialCameraPos]);

  useEffect(() => {
    if (!isSimulationLoading && fgRef.current && !hasIntroPlayed.current && graphData?.nodes?.length) {
      hasIntroPlayed.current = true;

      setTimeout(() => {
        // Start cinematic intro zoom
        fgRef.current.cameraPosition(
          { x: 0, y: 0, z: 650 },
          { x: 0, y: 0, z: 0 },
          4500
        );
      }, 500);
    }
  }, [isSimulationLoading, graphData]);

  useEffect(() => {
    const initEnvironment = () => {
      if (!fgRef.current) return;

      const scene = fgRef.current.scene();
      const camera = fgRef.current.camera();
      const renderer = fgRef.current.renderer();

      if (scene && !starfieldRef.current) {
        if (camera) {
          camera.far = 100000;
          camera.updateProjectionMatrix();
        }

        if (renderer) {
          renderer.shadowMap.enabled = true;
          renderer.setClearColor(0x0a0a0a, 1);
        }

        const starfieldResult = createStarfield(scene);
        starfieldRef.current = starfieldResult.group;
        nebulaeRef.current = starfieldResult.nebulae;
        scene.fog = new THREE.Fog(0x020205, 5000, 20000);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        scene.add(ambientLight);

        const mainLight = new THREE.PointLight(0xffffff, 3.5);
        mainLight.position.set(1000, 1000, 1000);
        scene.add(mainLight);

        const fillLight = new THREE.PointLight(0x0066ff, 2.5);
        fillLight.position.set(-1000, -1000, 1000);
        scene.add(fillLight);

        const backLight = new THREE.PointLight(0xff00ff, 1.5);
        backLight.position.set(0, 0, -1000);
        scene.add(backLight);
      }
    };

    const interval = setInterval(initEnvironment, 500);
    return () => clearInterval(interval);
  }, []);

  // Render
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#0a0a0a' }}>
      {isSimulationLoading && graphData && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0, 0, 0, 0.7)', zIndex: 1000, color: '#fff', fontSize: '18px', pointerEvents: 'none' }}>
          <div style={{ textAlign: 'center' }}>
            <div>Loading <span style={{ fontFamily: 'cursive', fontWeight: 'bold' }}>Osra</span> 3D Family Tree...</div>
            <div style={{ width: '40px', height: '40px', border: '4px solid rgba(255,255,255,0.3)', borderTop: '4px solid #fff', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '10px auto' }} />
          </div>
        </div>
      )}
      
      <ForceGraph3DAny
        graphData={filteredGraphData}
        nodeThreeObject={nodeThreeObject}
        linkThreeObject={linkThreeObject}
        linkPositionUpdate={linkPositionUpdate}
        linkDistance={(l: any) => activePreset ? (l.type === 'marriage' ? 450 : 250) : (l.type === 'marriage' ? 250 : 120)}
        linkStrength={(l: any) => activePreset ? 0.1 : (l.type === 'marriage' ? 0.3 : 0.8)}
        ref={fgRef}
        cooldownTicks={activePreset ? 600 : 200}
        onEngineStop={() => setIsSimulationLoading(false)}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={(node: any) => {
          const nodeId = getNodeId(node);
          if (!nodeId) return;
          
          const hasChildren = graphData?.links.some(l => {
            const sId = getNodeId(l.source);
            return sId === nodeId && l.type === 'parent';
          });
          
          if (hasChildren) {
            effectiveToggleCollapse(nodeId);
          }
        }}
        onBackgroundClick={onBackgroundClick}
        linkColor={(l: any) => {
          if (l.type === 'marriage') return '#f59e0b';
          if (l.type === 'divorce') return '#9ca3af';
          return '#60a5fa';
        }}
        linkWidth={(l: any) => (l.type === 'marriage' || l.type === 'divorce') ? 3 : 1.5}
        linkDashArray={(l: any) => l.type === 'divorce' ? [3, 2] : null}
        linkOpacity={showLinks ? 0.4 : 0}
        linkCurvature={(l: any) => {
          if (!activePreset) return (l.type === 'marriage' || l.type === 'divorce') ? 0.3 : 0;
          
          const sourceCluster = typeof l.source === 'object' ? l.source.familyCluster : null;
          const targetCluster = typeof l.target === 'object' ? l.target.familyCluster : null;
          
          // Only parent links WITHIN the active preset family should be straight
          if (l.type === 'parent' && sourceCluster === activePreset && targetCluster === activePreset) {
            return 0;
          }
          
          // Everything else (marriage links, background families, inter-family links) should be curved/flexible
          return 0.3;
        }}
        linkDirectionalArrowLength={(l: any) => (showArrows && l.type === 'parent') ? 8 : 0}
        linkDirectionalArrowColor={() => '#60a5fa'}
        showNavInfo={false}
      />

      {/* Settings Controls - Top Right */}
      <div style={{ position: 'absolute', top: '20px', right: '20px', display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 10, alignItems: 'flex-end' }}>
        {/* Settings Toggle - First */}
        <button
          onClick={() => setShowControls(!showControls)}
          style={{
            padding: '8px 16px',
            backgroundColor: '#444',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.8rem',
          }}
        >
          Settings ⚙️
        </button>

        {/* Ambiance Toggle - Below Settings */}
        <button
          onClick={() => setIsAmbienceOn(!isAmbienceOn)}
          style={{
            padding: '8px 16px',
            backgroundColor: isAmbienceOn ? '#10b981' : '#444',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.8rem',
          }}
        >
          {isAmbienceOn ? 'Ambiance 🔊' : 'Ambiance 🔇'}
        </button>

        {showControls && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '180px', backgroundColor: 'rgba(30, 30, 40, 0.95)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
            {/* 3D/2D Toggle */}
            {onModeChange && (
              <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                <button
                  onClick={() => onModeChange('3D')}
                  style={{ 
                    flex: 1,
                    padding: '6px 12px', 
                    backgroundColor: '#3b82f6', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '4px', 
                    cursor: 'pointer', 
                    fontSize: '0.75rem',
                    fontWeight: 600,
                  }}
                >
                  🌌 3D
                </button>
                <button
                  onClick={() => onModeChange('2D')}
                  style={{ 
                    flex: 1,
                    padding: '6px 12px', 
                    backgroundColor: '#444', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '4px', 
                    cursor: 'pointer', 
                    fontSize: '0.75rem' 
                  }}
                >
                  🌳 2D
                </button>
              </div>
            )}

            {/* Reset View */}
            <button
              onClick={resetView}
              style={{ padding: '6px 12px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
            >
              Reset View
            </button>

            <button onClick={() => setShowNames(!showNames)} style={{ padding: '6px 12px', backgroundColor: showNames ? '#3b82f6' : '#444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>
              {showNames ? 'Labels: ON' : 'Labels: OFF'}
            </button>
            <button onClick={() => setShowLinks(!showLinks)} style={{ padding: '6px 12px', backgroundColor: showLinks ? '#3b82f6' : '#444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>
              {showLinks ? 'Links: ON' : 'Links: OFF'}
            </button>
            <button onClick={() => setShowArrows(!showArrows)} style={{ padding: '6px 12px', backgroundColor: showArrows ? '#3b82f6' : '#444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>
              {showArrows ? 'Arrows: ON' : 'Arrows: OFF'}
            </button>

            {/* Expand/Collapse All */}
            <button
              onClick={() => {
                if (effectiveCollapsedNodes.size > 0) {
                  effectiveSetCollapsedNodes(new Set());
                } else {
                  const parents = new Set<string>();
                  graphData?.links.forEach(l => {
                    if (l.type === 'parent') {
                      const sId = getNodeId(l.source);
                      parents.add(sId);
                    }
                  });
                  effectiveSetCollapsedNodes(parents);
                }
              }}
              style={{ padding: '6px 12px', backgroundColor: '#f43f5e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
            >
              {effectiveCollapsedNodes.size > 0 ? 'Expand All' : 'Collapse All'}
            </button>

            <div ref={textureRef}>
              <button onClick={() => setIsTextureMenuOpen(!isTextureMenuOpen)} style={{ padding: '6px 12px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', width: '100%' }}>
                Texture: {nodeTexture}
              </button>
              {isTextureMenuOpen && (
                <div style={{ marginTop: '4px', backgroundColor: 'rgba(42, 42, 42, 0.95)', borderRadius: '4px', overflow: 'hidden' }}>
                  <button onClick={() => { setNodeTexture('spheres'); setIsTextureMenuOpen(false); }} style={{ padding: '8px', color: nodeTexture === 'spheres' ? '#3b82f6' : '#fff', border: 'none', background: 'transparent', width: '100%', textAlign: 'left', fontSize: '0.75rem' }}>Spheres</button>
                  <button onClick={() => { setNodeTexture('planets'); setIsTextureMenuOpen(false); }} style={{ padding: '8px', color: nodeTexture === 'planets' ? '#3b82f6' : '#fff', border: 'none', background: 'transparent', width: '100%', textAlign: 'left', fontSize: '0.75rem' }}>Planets</button>
                  <button onClick={() => { setNodeTexture('none'); setIsTextureMenuOpen(false); }} style={{ padding: '8px', color: nodeTexture === 'none' ? '#3b82f6' : '#fff', border: 'none', background: 'transparent', width: '100%', textAlign: 'left', fontSize: '0.75rem' }}>None</button>
                </div>
              )}
            </div>

            {/* Family Presets */}
            <div ref={presetsRef}>
              <button onClick={() => setIsPresetsOpen(!isPresetsOpen)} style={{ padding: '6px 12px', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', width: '100%' }}>
                Family Presets ▾
              </button>
              {isPresetsOpen && (
                <div style={{ marginTop: '4px', backgroundColor: 'rgba(42, 42, 42, 0.95)', borderRadius: '4px', overflow: 'hidden', maxHeight: '250px', overflowY: 'auto' }}>
                  <button onClick={() => applyPreset(null)} style={{ padding: '8px', color: !activePreset ? '#3b82f6' : '#fff', border: 'none', background: 'transparent', width: '100%', textAlign: 'left', fontSize: '0.75rem' }}>3D Global View</button>
                  
                  {userProfile?.node_id && (
                    <button 
                      onClick={() => applyPreset('me')} 
                      style={{ padding: '8px', color: '#10b981', border: 'none', background: 'transparent', width: '100%', textAlign: 'left', fontSize: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}
                    >
                      Focus on Me 📍
                    </button>
                  )}

                  <div style={{ padding: '8px 8px 4px', fontSize: '0.6rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>Families</div>
                  {uniqueClusters.map(cluster => (
                    <button key={cluster} onClick={() => applyPreset(cluster)} style={{ padding: '8px', color: activePreset === cluster ? '#3b82f6' : '#fff', border: 'none', background: 'transparent', width: '100%', textAlign: 'left', fontSize: '0.75rem' }}>
                      {cluster}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Nav Controls - Bottom Right (Collapsible) */}
      <div style={{ 
        position: 'absolute', 
        bottom: '20px', 
        right: '20px', 
        zIndex: 10,
      }}>
        {showNavControls ? (
          <div style={{ 
            backgroundColor: 'rgba(30, 30, 40, 0.95)', 
            padding: '8px 12px', 
            borderRadius: '8px', 
            color: '#e5e7eb', 
            fontSize: '0.7rem', 
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
            minWidth: '180px',
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: '6px',
              paddingBottom: '4px',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              cursor: 'pointer',
            }} onClick={() => setShowNavControls(false)}>
              <div style={{ fontWeight: 700, fontSize: '0.75rem', letterSpacing: '1px' }}>NAV CONTROLS</div>
              <div style={{ fontSize: '0.8rem' }}>👁️</div>
            </div>
            <div style={{ lineHeight: '1.6' }}>
              <div><span style={{ color: isSteeringActive ? '#10b981' : '#fbbf24', fontWeight: 600 }}>R</span>: Mouse Steering <span style={{ color: isSteeringActive ? '#10b981' : '#fbbf24' }}>({isSteeringActive ? 'ACTIVE' : 'LOCKED'})</span></div>
              <div><span style={{ color: '#fff', fontWeight: 600 }}>WASD</span>: Move (Hold <span style={{ color: '#fff', fontWeight: 600 }}>Shift</span> for Boost)</div>
              <div><span style={{ color: '#fff', fontWeight: 600 }}>Q / E</span>: Roll View L / R</div>
              <div><span style={{ color: '#fff', fontWeight: 600 }}>Tab</span>: Cycle Names</div>
              <div><span style={{ color: '#fff', fontWeight: 600 }}>Enter</span>: Focus selection</div>
              <div><span style={{ color: '#fff', fontWeight: 600 }}>Esc</span>: Deselect</div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowNavControls(true)}
            style={{
              backgroundColor: 'rgba(30, 30, 40, 0.95)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              padding: '8px 12px',
              color: '#e5e7eb',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: 700,
              letterSpacing: '1px',
              boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
            }}
          >
            NAV CONTROLS 👁️
          </button>
        )}
      </div>
    </div>
  );
};

// Default export for backward compatibility
export default FamilyTree3DContent;

