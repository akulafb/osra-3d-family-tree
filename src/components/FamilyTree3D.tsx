// src/components/FamilyTree3D.tsx

import React, { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import SpriteText from 'three-spritetext';
import * as THREE from 'three';
import { FamilyNode } from '../types/graph';
import { useFamilyData } from '../hooks/useFamilyData';
import { useAuth } from '../contexts/AuthContext';
import AddRelativeModal from './modals/AddRelativeModal';
import EditNodeModal from './modals/EditNodeModal';
import BulkInviteModal from './modals/BulkInviteModal';
import { canEdit, FamilyLink } from '../lib/permissions';
import { createStarfield } from '../utils/starfield';

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
  '/planet-textures/sun.jpg'
];

const textureLoader = new THREE.TextureLoader();
const planetMaterialCache = new Map<string, THREE.MeshPhysicalMaterial>();

const getPlanetMaterial = (nodeId: string) => {
  // Use node ID to deterministically assign a planet texture
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

// Material cache for cluster colors (Metallic Spheres)
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
  'Badran': '#0066ff',   // Deep Blue
  'Kutob': '#00ff88',    // Vibrant Green
  'Hajjaj': '#ffaa00',   // Bright Orange
  'Zabalawi': '#ff00aa', // Hot Pink
  'Malhis': '#aa00ff',   // Electric Purple
  'Shawa': '#ff3333',    // Crimson
  'Dajani': '#33ffff',   // Cyan
  'Masri': '#ffff33',    // Yellow
  'Tamimi': '#00ff00',   // Lime
  'Husaini': '#ff0000',  // Red
  'Nabulsi': '#ff6600',  // Orange-Red
  'Ghazali': '#00ccff',  // Sky Blue
  'Rifai': '#cc00ff',    // Violet
  'Qudsi': '#66ff00',    // Bright Lime
  'Jaabari': '#ff0066',  // Rose
  'Khalidi': '#00ffcc',  // Aquamarine
};

const getClusterColor = (cluster: string | undefined | null) => {
  if (!cluster) return '#ffffff';
  if (familyColors[cluster]) return familyColors[cluster];
  
  // Deterministic fallback for unknown clusters
  const colors = Object.values(familyColors);
  let hash = 0;
  for (let i = 0; i < cluster.length; i++) {
    hash = cluster.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

// Helper for descendant tracking
const getDescendantIds = (nodeId: string, links: FamilyLink[]): string[] => {
  const descendants: string[] = [];
  const queue = [nodeId];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    // Only follow parent -> child links (excluding marriage)
    const children = links
      .filter(l => {
        const sourceId = typeof l.source === 'object' ? (l.source as any).id : l.source;
        return sourceId === currentId && l.type === 'parent';
      })
      .map(l => typeof l.target === 'object' ? (l.target as any).id : l.target);

    descendants.push(...children);
    queue.push(...children);
  }
  return descendants;
};

const FamilyTreeContent: React.FC = () => {
  const ForceGraph3DAny = ForceGraph3D as unknown as React.ComponentType<any>;
  const { graphData, isLoading: dataLoading, error: dataError, refetch } = useFamilyData();
  const { user, userProfile } = useAuth();

  // V3 Geometries (memoized to prevent recreation)
  const geometries = useMemo(() => ({
    sphere: new THREE.SphereGeometry(10, 16, 16), // Reduced detail for performance
    aura: new THREE.SphereGeometry(18, 12, 12),   // Reduced detail
    glow: new THREE.SphereGeometry(22, 12, 12)    // Reduced detail
  }), []);

  const fgRef = useRef<any>();
  const starfieldRef = useRef<THREE.Group | null>(null);
  const presetsRef = useRef<HTMLDivElement>(null);

  // Global rotation state for moire/rotation (performance boost!)
  const rotationRef = useRef(0);
  useEffect(() => {
    let frameId: number;
    const animate = () => {
      rotationRef.current += 0.007; // Slowed down by 30%
      
      // Ambient starfield rotation
      if (starfieldRef.current) {
        starfieldRef.current.rotation.y += 0.0002;
        starfieldRef.current.rotation.x += 0.0001;
      }

      frameId = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(frameId);
  }, []);

  const [initialCameraPos, setInitialCameraPos] = useState<{ x: number; y: number; z: number } | null>(null);
  const [isSimulationLoading, setIsSimulationLoading] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [selectedNode, setSelectedNode] = useState<FamilyNode | null>(null);
  const [canEditSelected, setCanEditSelected] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isBulkInviteOpen, setIsBulkInviteOpen] = useState(false);
  const [isPresetsOpen, setIsPresetsOpen] = useState(false);
  const [isTextureMenuOpen, setIsTextureMenuOpen] = useState(false);
  const textureRef = useRef<HTMLDivElement>(null);
  const [showLegend, setShowLegend] = useState(true);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  // V3 Features: Toggles and Collapsed state
  const [showNames, setShowNames] = useState(true);
  const [showLinks, setShowLinks] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [nodeTexture, setNodeTexture] = useState<'spheres' | 'planets' | 'none'>('spheres');
  const [showArrows, setShowArrows] = useState(false);
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    console.log('[FamilyTree3D] Component state:', { 
      hasData: !!graphData, 
      nodesCount: graphData?.nodes?.length,
      linksCount: graphData?.links?.length,
      showNames, 
      showLinks,
      nodeTexture, 
      showArrows,
      collapsedCount: collapsedNodes.size 
    });
  }, [graphData, showNames, showLinks, nodeTexture, showArrows, collapsedNodes]);

  const toggleNodeCollapse = useCallback((nodeId: string) => {
    console.log('[FamilyTree3D] Toggling collapse for node:', nodeId);
    setCollapsedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  const filteredGraphData = useMemo(() => {
    try {
      if (!graphData) return { nodes: [], links: [] };

      const hiddenNodes = new Set<string>();
      collapsedNodes.forEach(id => {
        const descendants = getDescendantIds(id, graphData.links as FamilyLink[]);
        descendants.forEach(dId => hiddenNodes.add(dId));
      });

      const filtered = {
        nodes: graphData.nodes.filter(n => !hiddenNodes.has(n.id)),
        links: (graphData.links as any[]).filter(l => {
          const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
          const targetId = typeof l.target === 'object' ? l.target.id : l.target;
          return !hiddenNodes.has(sourceId) && !hiddenNodes.has(targetId);
        })
      };
      console.log('[FamilyTree3D] Filtered data:', { 
        originalNodes: graphData.nodes.length, 
        filteredNodes: filtered.nodes.length,
        hiddenCount: hiddenNodes.size,
        activePreset
      });
      return filtered;
    } catch (err) {
      console.error('[FamilyTree3D] Error filtering graph data:', err);
      // Removed setRenderError to avoid "update during render" warning
      return { nodes: [], links: [] };
    }
  }, [graphData, collapsedNodes, activePreset]);

  const uniqueClusters = React.useMemo(() => {
    if (!graphData?.nodes) return [];
    const clusters = new Set<string>();
    graphData.nodes.forEach(n => {
      if (n.familyCluster) clusters.add(n.familyCluster);
    });
    return Array.from(clusters).sort();
  }, [graphData]);

  useEffect(() => {
    console.log('[FamilyTree3D] Component mounted. Loading state:', { dataLoading, isSimulationLoading });
    console.log('[FamilyTree3D] Graph data presence:', !!graphData, 'Nodes:', graphData?.nodes?.length, 'Links:', graphData?.links?.length);
  }, [dataLoading, isSimulationLoading, graphData]);

  // Keyboard and Mouse state
  const [isSteeringActive, setIsSteeringActive] = useState(false); // Engine starts OFF
  const keysPressed = useRef<Record<string, boolean>>({});
  const mousePos = useRef({ x: 0, y: 0 });
  const isMouseInWindow = useRef(true);

  // Check permissions
  useEffect(() => {
    if (selectedNode && user && graphData?.links && userProfile?.node_id) {
      const result = canEdit(selectedNode.id, userProfile.node_id, userProfile.role === 'admin', graphData.links as FamilyLink[]);
      setCanEditSelected(result);
    } else {
      setCanEditSelected(false);
    }
  }, [selectedNode, user, userProfile, graphData]);

  // Data Validation
  useEffect(() => {
    if (!graphData) return;
    if (!graphData.nodes || graphData.nodes.length === 0) {
      setValidationError('No family members found in data');
    } else {
      setValidationError(null);
    }
  }, [graphData]);

  // Focus Logic
  const handleNodeClick = useCallback((node: FamilyNode) => {
    if (!fgRef.current) return;
    
    const nodeData = node as any;
    setSelectedNode(node);
    
    // Ensure coordinates are valid before processing
    const x = (typeof nodeData.x === 'number' && !isNaN(nodeData.x)) ? nodeData.x : 0;
    const y = (typeof nodeData.y === 'number' && !isNaN(nodeData.y)) ? nodeData.y : 0;
    const z = (typeof nodeData.z === 'number' && !isNaN(nodeData.z)) ? nodeData.z : 0;
    
    const nodePos = { x, y, z };
    const distance = 120;
    
    const camera = fgRef.current.camera();
    const currentPos = camera.position;
    
    // Calculate new camera position
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

    console.log('[FamilyTree3D] Camera move to:', targetPos, 'looking at:', nodePos);
    
    // Use the force-graph's built-in cameraPosition for smooth, safe animation
    fgRef.current.cameraPosition(targetPos, nodePos, 800);
  }, []);

  const resetView = useCallback(() => {
    if (!fgRef.current || !initialCameraPos || !graphData) return;

    setActivePreset(null);
    // Clear all fixed positions and ensure no NaN coordinates
    graphData.nodes.forEach((node: any) => {
      node.fx = undefined;
      node.fy = undefined;
      node.fz = undefined;
      if (isNaN(node.x) || isNaN(node.y) || isNaN(node.z)) {
        node.x = 0;
        node.y = 0;
        node.z = 0;
      }
    });
    fgRef.current.d3ReheatSimulation();

    // Use built-in cameraPosition for reset
    fgRef.current.cameraPosition(
      { x: initialCameraPos.x, y: initialCameraPos.y, z: initialCameraPos.z },
      { x: 0, y: 0, z: 0 },
      1000
    );
  }, [initialCameraPos, graphData]);

  // Continuous Flight Loop
  useEffect(() => {
    let frameId: number;
    const baseSpeed = 1.2;
    const boostMultiplier = 4.0;
    const turnSpeed = 0.012;
    const deadzone = 0.15;

    const update = () => {
      if (fgRef.current && !isAddModalOpen && !isEditModalOpen && !isBulkInviteOpen && 
          document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        
        const camera = fgRef.current.camera();
        const controls = fgRef.current.controls();
        
        if (camera && controls) {
          // 1. Steering (Only if active and mouse in window)
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

          // 2. Thrust/Strafe
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
          
          camera.updateProjectionMatrix();
        }
      }
      frameId = requestAnimationFrame(update);
    };
    frameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frameId);
  }, [isAddModalOpen, isEditModalOpen, isBulkInviteOpen, isSteeringActive]);

  // Event Listeners
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keysPressed.current[key] = true;
      if (isAddModalOpen || isEditModalOpen || isBulkInviteOpen || document.activeElement?.tagName === 'INPUT') return;
      
      if (key === 'e') {
        setIsSteeringActive(prev => !prev);
      } else if (key === 'tab') {
        e.preventDefault();
        if (graphData?.nodes?.length) {
          const idx = selectedNode ? graphData.nodes.findIndex(n => n.id === selectedNode.id) : -1;
          const next = e.shiftKey ? (idx <= 0 ? graphData.nodes.length - 1 : idx - 1) : (idx + 1) % graphData.nodes.length;
          setSelectedNode(graphData.nodes[next]);
        }
      } else if (key === 'enter' || key === ' ') {
        if (selectedNode) { e.preventDefault(); handleNodeClick(selectedNode); }
      } else if (key === 'escape') {
        if (selectedNode) { e.preventDefault(); setSelectedNode(null); }
      }
    };
    const onUp = (e: KeyboardEvent) => { keysPressed.current[e.key.toLowerCase()] = false; };
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
    
    const onClickOutside = (e: MouseEvent) => {
      if (presetsRef.current && !presetsRef.current.contains(e.target as Node)) {
        setIsPresetsOpen(false);
      }
      if (textureRef.current && !textureRef.current.contains(e.target as Node)) {
        setIsTextureMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', onClickOutside);
    
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseleave', onOut);
      window.removeEventListener('mouseenter', onIn);
      window.removeEventListener('mousedown', onClickOutside);
    };
  }, [graphData, selectedNode, handleNodeClick, isAddModalOpen, isEditModalOpen, isBulkInviteOpen]);

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

    // 1. Find roots in this cluster (nodes with no parents in this cluster)
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

    // BFS to assign levels
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
            // If we're at a node and find its spouse or parent
            const nextLevel = link.type === 'marriage' ? level : level - 1;
            // Only go "up" if it's a parent, but we started from roots so we mostly go down
            if (link.type === 'marriage') {
              levels.set(s, nextLevel);
              queue.push({ id: s, level: nextLevel });
            }
          }
        }
      });
    }
    
    // Assign 0 to any orphans
    nodesInCluster.forEach(n => {
      if (!levels.has(n.id)) levels.set(n.id, 0);
    });

    return levels;
  }, [graphData]);

  const applyPreset = useCallback((type: string) => {
    setIsPresetsOpen(false);
    if (!fgRef.current || !graphData) return;

    if (type === 'overview') {
      resetView();
      return;
    }

    let clusterName = type;
    if (type === 'me') {
      const userNode = graphData.nodes.find(n => n.id === userProfile?.node_id);
      clusterName = userNode?.familyCluster || '';
    }

    if (!clusterName) return;

    setActivePreset(clusterName);
    const levels = calculateGenerationLevels(clusterName);
    const generationHeight = 250; 
    const horizontalSpread = 300; 
    
    const nodesInCluster = graphData.nodes.filter(n => n.familyCluster === clusterName);
    const clusterNodeIds = new Set(nodesInCluster.map(n => n.id));

    // 1. Build adjacency list for children
    const childrenMap = new Map<string, string[]>();
    graphData.links.forEach(link => {
      if (link.type === 'parent') {
        const s = typeof link.source === 'object' ? link.source.id : link.source;
        const t = typeof link.target === 'object' ? link.target.id : link.target;
        if (clusterNodeIds.has(s) && clusterNodeIds.has(t)) {
          const list = childrenMap.get(s) || [];
          list.push(t);
          childrenMap.set(s, list);
        }
      }
    });

    // 2. Calculate subtree widths (number of leaf nodes)
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

    // 3. Find roots (nodes with no parents in cluster)
    const roots = nodesInCluster.filter(node => {
      const hasParent = graphData.links.some(link => {
        const t = typeof link.target === 'object' ? link.target.id : link.target;
        const s = typeof link.source === 'object' ? link.source.id : link.source;
        return t === node.id && link.type === 'parent' && clusterNodeIds.has(s);
      });
      return !hasParent;
    });

    // Calculate widths for all roots
    let totalClusterWidth = 0;
    roots.forEach(root => {
      totalClusterWidth += getSubtreeWidth(root.id);
    });

    // 4. Recursive positioning
    const positionNode = (id: string, leftX: number, width: number, level: number) => {
      const node = graphData.nodes.find(n => n.id === id);
      if (!node) return;

      const centerX = leftX + (width * horizontalSpread) / 2;
      const centerY = level * generationHeight;

      node.fx = centerX;
      node.fy = centerY;
      node.fz = 0;
      node.x = centerX;
      node.y = centerY;
      node.z = 0;

      const children = childrenMap.get(id) || [];
      let currentLeft = leftX;
      children.forEach(childId => {
        const childWidth = subtreeWidths.get(childId) || 1;
        positionNode(childId, currentLeft, childWidth, level + 1);
        currentLeft += childWidth * horizontalSpread;
      });
    };

    // Position roots
    let currentRootLeft = -(totalClusterWidth * horizontalSpread) / 2;
    roots.forEach(root => {
      const rootWidth = subtreeWidths.get(root.id) || 1;
      positionNode(root.id, currentRootLeft, rootWidth, levels.get(root.id) || 0);
      currentRootLeft += rootWidth * horizontalSpread;
    });

    // Position non-cluster nodes
    graphData.nodes.forEach((node: any) => {
      if (node.familyCluster !== clusterName) {
        const safeX = (typeof node.x === 'number' && !isNaN(node.x)) ? node.x : (Math.random() - 0.5) * 2000;
        const safeY = (typeof node.y === 'number' && !isNaN(node.y)) ? node.y : (Math.random() - 0.5) * 2000;
        node.fx = safeX;
        node.fy = safeY;
        node.fz = -1000;
        node.x = safeX;
        node.y = safeY;
        node.z = -1000;
      }
    });

    // Reheat simulation
    if (fgRef.current) {
      fgRef.current.d3ReheatSimulation();
    }

    // Focus camera on the cluster after a small delay to let positions settle
    setTimeout(() => {
      if (!fgRef.current || !graphData) return;
      
      if (type === 'me' && userProfile?.node_id) {
        focusNodeById(userProfile.node_id);
      } else {
        // Find a good representative for the cluster
        const rep = (clusterName === 'Badran') 
          ? graphData.nodes.find(n => n.name === 'Basel Badran')
          : graphData.nodes.find(n => n.familyCluster === clusterName);
        
        if (rep) {
          console.log('[FamilyTree3D] Focusing preset representative:', rep.name);
          focusNodeById(rep.id);
        } else {
          console.warn('[FamilyTree3D] No representative found for cluster:', clusterName);
        }
      }
    }, 200);
  }, [userProfile, graphData, calculateGenerationLevels, resetView, focusNodeById]);

  // Node UI with visual upgrades
  const nodeThreeObject = useCallback((node: FamilyNode) => {
    try {
      const isSelected = selectedNode?.id === node.id;
      const color = getClusterColor(node.familyCluster);
      const group = new THREE.Group();

      // 1. Core Sphere / Planet
      if (nodeTexture !== 'none') {
        const material = nodeTexture === 'planets' ? getPlanetMaterial(node.id) : getMaterial(color);
        const sphere = new THREE.Mesh(geometries.sphere, material);
        group.add(sphere);

        // Performance-friendly animation - attach to mesh to ensure it's called during render
        const speedFactor = 0.5 + Math.random() * 0.5;
        sphere.onBeforeRender = () => {
          const rot = rotationRef.current * speedFactor;
          // Rotate ONLY the sphere mesh, NOT the group
          // This prevents dragging issues where the group's rotation interferes with world-space movement
          sphere.rotation.y = rot;
          sphere.rotation.z = rot * 0.5;
        };

        // Aura & Glow if selected
        if (isSelected) {
          const aura = new THREE.Mesh(geometries.aura, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.2, wireframe: true }));
          const glow = new THREE.Mesh(geometries.glow, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.05 }));
          group.add(aura);
          group.add(glow);
        }
      }

      // 2. Name/Label (SpriteText) - Inside sphere
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
      
      // Only apply elbows to links within the active family cluster
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
        // Add a small deterministic offset based on the source ID to prevent perfect overlaps
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        let hash = 0;
        for (let i = 0; i < sourceId.length; i++) {
          hash = ((hash << 5) - hash) + sourceId.charCodeAt(i);
          hash |= 0;
        }
        const staggerOffset = (Math.abs(hash) % 20) - 10; // +/- 10px offset
        
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
      if (camera) setInitialCameraPos({ x: camera.position.x, y: camera.position.y, z: camera.position.z });
    }
  }, [initialCameraPos]);

  useEffect(() => {
    const handleError = (e: ErrorEvent) => {
      console.error('[FamilyTree3D] Global error caught:', e.message);
      setRenderError('Runtime Error: ' + e.message);
    };
    window.addEventListener('error', handleError);
    
    // Safety loop to catch NaN explosions
    const checkNaN = setInterval(() => {
      if (!graphData?.nodes) return;
      let exploded = false;
      for (const node of graphData.nodes as any) {
        if (isNaN(node.x) || isNaN(node.y) || isNaN(node.z)) {
          exploded = true;
          node.x = node.x || 0;
          node.y = node.y || 0;
          node.z = node.z || 0;
          node.fx = undefined; node.fy = undefined; node.fz = undefined;
        }
      }
      if (exploded && fgRef.current) {
        console.warn('[FamilyTree3D] Physics exploded! Resetting NaN nodes...');
        fgRef.current.d3ReheatSimulation();
      }
    }, 2000);

    return () => {
      window.removeEventListener('error', handleError);
      clearInterval(checkNaN);
    };
  }, [graphData]);

  // V3 Starfield & Environment Initialization
  useEffect(() => {
    const initEnvironment = () => {
      if (!fgRef.current) return;

      const scene = fgRef.current.scene();
      const camera = fgRef.current.camera();
      const renderer = fgRef.current.renderer();

      if (scene && !starfieldRef.current) {
        console.log('[FamilyTree3D] Initializing 3D Starfield & Environment...');
        
        // Camera setup
        if (camera) {
          camera.far = 100000;
          camera.updateProjectionMatrix();
        }

        // Renderer setup
        if (renderer) {
          renderer.shadowMap.enabled = true;
          renderer.setClearColor(0x0a0a0a, 1);
        }

        // Scene environment
        scene.background = null;
        starfieldRef.current = createStarfield(scene);
        scene.fog = new THREE.Fog(0x020205, 5000, 20000);

        // Lights
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

  const isLoading = dataLoading || isSimulationLoading;
  const error = dataError || validationError || renderError;

  if (error) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100vh', background: '#0a0a0a', color: '#ef4444', textAlign: 'center' }}><div><h2>Error Loading Family Tree</h2><p>{error}</p></div></div>;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#0a0a0a' }}>
      {isLoading && <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0, 0, 0, 0.7)', zIndex: 1000, color: '#fff', fontSize: '18px' }}><div style={{ textAlign: 'center' }}><div>Loading Family Tree...</div><div style={{ width: '40px', height: '40px', border: '4px solid rgba(255,255,255,0.3)', borderTop: '4px solid #fff', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '10px auto' }} /></div></div>}
      
      <ForceGraph3DAny
        graphData={filteredGraphData}
        nodeThreeObject={nodeThreeObject}
        linkThreeObject={linkThreeObject}
        linkPositionUpdate={linkPositionUpdate}
        linkDistance={(l: any) => {
          if (activePreset) {
            const s = typeof l.source === 'object' ? l.source.familyCluster : null;
            const t = typeof l.target === 'object' ? l.target.familyCluster : null;
            if (s === activePreset && t === activePreset) {
              return l.type === 'marriage' ? 450 : 250; 
            }
          }
          return l.type === 'marriage' ? 250 : 120; // Increased distances for larger spheres
        }}
        linkStrength={(l: any) => {
          if (activePreset) {
            const s = typeof l.source === 'object' ? l.source.familyCluster : null;
            const t = typeof l.target === 'object' ? l.target.familyCluster : null;
            if (s === activePreset && t === activePreset) {
              return 0.1; 
            }
          }
          return l.type === 'marriage' ? 0.3 : 0.8;
        }}
        ref={fgRef}
        cooldownTicks={activePreset ? 600 : 200}
        onEngineStop={() => setIsSimulationLoading(false)}
        onNodeClick={(node: FamilyNode) => {
          // Toggle collapse if node has children
          const hasChildren = graphData?.links.some(l => {
            const sId = typeof l.source === 'object' ? (l.source as any).id : l.source;
            return sId === node.id && l.type === 'parent';
          });
          
          if (hasChildren) {
            toggleNodeCollapse(node.id);
          } else {
            handleNodeClick(node); // Focus if no children to toggle
          }
        }}
        onNodeRightClick={(node: FamilyNode) => {
          handleNodeClick(node); // Right click to focus/select
        }}
        linkColor={(l: any) => l.type === 'marriage' ? '#f59e0b' : '#60a5fa'}
        linkWidth={(l: any) => l.type === 'marriage' ? 3 : 1.5}
        linkOpacity={showLinks ? 0.4 : 0}
        linkCurvature={(l: any) => {
          if (activePreset) {
            const s = typeof l.source === 'object' ? l.source.familyCluster : null;
            const t = typeof l.target === 'object' ? l.target.familyCluster : null;
            if (s === activePreset && t === activePreset) return 0;
          }
          return l.type === 'marriage' ? 0.3 : 0;
        }}
        linkDirectionalArrowLength={(l: any) => (showArrows && l.type === 'parent') ? 8 : 0}
        linkDirectionalArrowColor={() => '#60a5fa'}
        showNavInfo={true}
        onBackgroundClick={() => setSelectedNode(null)}
      />

      {selectedNode && (
        <div style={panelStyle}>
          <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'white' }}>{selectedNode.name}</div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            {canEditSelected && (
              <>
                <button onClick={() => setIsEditModalOpen(true)} style={btnStyle('#f59e0b')}>✎ Edit</button>
                <button onClick={() => setIsAddModalOpen(true)} style={btnStyle('#667eea')}>+ Add Relative</button>
                {selectedNode.id === userProfile?.node_id && <button onClick={() => setIsBulkInviteOpen(true)} style={btnStyle('#10b981')}>Invite Family</button>}
              </>
            )}
            <button onClick={() => setSelectedNode(null)} style={btnStyle('transparent', '#444')}>Close</button>
          </div>
        </div>
      )}

      {selectedNode && <AddRelativeModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} targetNode={selectedNode} onSuccess={() => { refetch(); setSelectedNode(null); }} existingNodes={graphData?.nodes || []} />}
      {userProfile?.node_id && <BulkInviteModal isOpen={isBulkInviteOpen} onClose={() => setIsBulkInviteOpen(false)} allNodes={graphData?.nodes || []} allLinks={graphData?.links ? [...graphData.links] : []} userNodeId={userProfile.node_id} onSuccess={() => {}} />}
      {selectedNode && <EditNodeModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} targetNode={selectedNode} onSuccess={() => refetch()} existingNodes={graphData?.nodes || []} />}

      <div style={{ position: 'absolute', top: '20px', right: '20px', display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 10, alignItems: 'flex-end' }}>
        <button 
          onClick={() => setShowControls(!showControls)} 
          style={{
            ...topBtnStyle(showControls ? '#3b82f6' : '#444'),
            fontSize: '1.1rem',
            padding: '4px 8px',
            width: 'auto',
          }}
          title={showControls ? "Hide Controls" : "Show Controls"}
        >
          ⚙️
        </button>

        {showControls && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '180px' }}>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button onClick={() => setShowNames(!showNames)} style={topBtnStyle(showNames ? '#3b82f6' : '#444')}>
                {showNames ? 'Labels: ON' : 'Labels: OFF'}
              </button>
              
              <div style={{ position: 'relative' }} ref={textureRef}>
                <button onClick={() => setIsTextureMenuOpen(!isTextureMenuOpen)} style={topBtnStyle('#3b82f6')}>Texture ▾</button>
                {isTextureMenuOpen && (
                  <div style={presetMenuStyle}>
                    <div style={{ padding: '8px 15px', fontSize: '0.7rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>Style</div>
                    <button onClick={() => { setNodeTexture('spheres'); setIsTextureMenuOpen(false); }} className="preset-item" style={{ color: nodeTexture === 'spheres' ? '#3b82f6' : '#fff' }}>Spheres</button>
                    <button onClick={() => { setNodeTexture('planets'); setIsTextureMenuOpen(false); }} className="preset-item" style={{ color: nodeTexture === 'planets' ? '#3b82f6' : '#fff' }}>Planets</button>
                    <button onClick={() => { setNodeTexture('none'); setIsTextureMenuOpen(false); }} className="preset-item" style={{ color: nodeTexture === 'none' ? '#3b82f6' : '#fff' }}>None</button>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '4px' }}>
              <button onClick={() => setShowLinks(!showLinks)} style={topBtnStyle(showLinks ? '#3b82f6' : '#444')}>
                {showLinks ? 'Links: ON' : 'Links: OFF'}
              </button>

              <button onClick={() => setShowArrows(!showArrows)} style={topBtnStyle(showArrows ? '#3b82f6' : '#444')}>
                {showArrows ? 'Arrows: ON' : 'Arrows: OFF'}
              </button>
            </div>

            <button 
              onClick={() => {
                if (collapsedNodes.size > 0) {
                  setCollapsedNodes(new Set());
                } else {
                  // Collapse all nodes that have children
                  const allParents = new Set<string>();
                  graphData?.links.forEach(l => {
                    if (l.type === 'parent') {
                      allParents.add(typeof l.source === 'object' ? (l.source as any).id : l.source);
                    }
                  });
                  setCollapsedNodes(allParents);
                }
              }} 
              style={topBtnStyle('#f43f5e')}
            >
              {collapsedNodes.size > 0 ? 'Expand All' : 'Collapse All'}
            </button>

            <button onClick={() => { setIsSimulationLoading(true); fgRef.current?.d3Force('charge')?.restart(); }} style={topBtnStyle('#3b82f6')}>Restart Simulation</button>
            
            <div style={{ position: 'relative' }} ref={presetsRef}>
              <button onClick={() => setIsPresetsOpen(!isPresetsOpen)} style={topBtnStyle('#8b5cf6')}>Presets ▾</button>
              {isPresetsOpen && (
                <div style={presetMenuStyle}>
                  <div style={{ padding: '8px 15px', fontSize: '0.7rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>Views</div>
                  <button onClick={() => applyPreset('me')} className="preset-item">Focus on Me</button>
                  <button onClick={() => applyPreset('overview')} className="preset-item">3D Global View (Reset)</button>
                  
                  <div style={{ height: '1px', background: '#444', margin: '4px 0' }} />
                  <div style={{ padding: '8px 15px', fontSize: '0.7rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>Family Presets (2D)</div>
                  
                  {uniqueClusters.map(cluster => (
                    <button 
                      key={cluster} 
                      onClick={() => applyPreset(cluster)} 
                      className="preset-item"
                      style={{ color: cluster === 'Badran' ? '#3b82f6' : 
                                      cluster === 'Kutob' ? '#10b981' : 
                                      cluster === 'Hajjaj' ? '#f59e0b' :
                                      cluster === 'Zabalawi' ? '#ec4899' :
                                      cluster === 'Malhis' ? '#8b5cf6' : '#fff' }}
                    >
                      {cluster} Family
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button onClick={resetView} style={topBtnStyle('#10b981')}>Reset View</button>
          </div>
        )}
      </div>
      
      <div 
        onClick={() => setShowLegend(!showLegend)}
        style={{ 
          ...legendStyle, 
          cursor: 'pointer', 
          pointerEvents: 'auto',
          transition: 'all 0.3s ease',
          userSelect: 'none'
        }}
      >
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: showLegend ? '8px' : '0',
          gap: '10px'
        }}>
          <strong style={{ fontSize: '0.8rem', color: '#fff' }}>NAV CONTROLS</strong>
          <span>{showLegend ? '👁️' : '👁️‍🗨️'}</span>
        </div>

        {showLegend && (
          <>
            <div style={{ marginBottom: '4px', color: isSteeringActive ? '#10b981' : '#f59e0b' }}>
              <strong>E</strong>: Mouse Steering ({isSteeringActive ? 'ACTIVE' : 'LOCKED'})
            </div>
            <div style={{ marginBottom: '4px' }}><strong>WASD</strong>: Move (Hold <strong>Shift</strong> for Boost)</div>
            <div style={{ marginBottom: '4px' }}><strong>Tab</strong>: Cycle Names</div>
            <div style={{ marginBottom: '4px' }}><strong>Enter</strong>: Focus selection</div>
            <div><strong>Esc</strong>: Deselect</div>
          </>
        )}
      </div>
    </div>
  );
};

const FamilyTree3D: React.FC = () => {
  // Debug: Check for missing env vars FIRST to avoid hook mismatch in the main content
  const hasEnvVars = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!hasEnvVars) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100vh', background: '#0a0a0a', color: '#f59e0b', textAlign: 'center', padding: '20px' }}>
        <div>
          <h2>⚠️ Configuration Missing</h2>
          <p>Supabase environment variables are not set. Please add <strong>VITE_SUPABASE_URL</strong> and <strong>VITE_SUPABASE_ANON_KEY</strong> to your Vercel project settings.</p>
        </div>
      </div>
    );
  }

  return <FamilyTreeContent />;
};

const panelStyle: React.CSSProperties = { position: 'absolute', bottom: '40px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'rgba(42, 42, 42, 0.9)', padding: '15px 25px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 100, boxShadow: '0 4px 15px rgba(0,0,0,0.5)', border: '1px solid #444' };
const btnStyle = (bg: string, border = 'none') => ({ padding: '6px 12px', backgroundColor: bg, color: 'white', border: border === 'none' ? 'none' : `1px solid ${border}`, borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' as const, fontSize: '0.75rem' });
const topBtnStyle = (bg: string) => ({ padding: '6px 12px', backgroundColor: bg, color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' as const, width: '100%', textAlign: 'center' as const, fontSize: '0.75rem' });
const presetMenuStyle: React.CSSProperties = { position: 'absolute', top: '100%', right: 0, marginTop: '5px', backgroundColor: 'rgba(42, 42, 42, 0.95)', borderRadius: '8px', border: '1px solid #444', overflowX: 'hidden', overflowY: 'auto', maxHeight: '400px', minWidth: '180px', boxShadow: '0 4px 15px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', zIndex: 20 };
const legendStyle: React.CSSProperties = { position: 'absolute', bottom: '20px', right: '20px', backgroundColor: 'rgba(0, 0, 0, 0.7)', padding: '12px', borderRadius: '8px', color: '#ccc', fontSize: '0.75rem', zIndex: 10, border: '1px solid rgba(255, 255, 255, 0.1)', boxShadow: '0 4px 15px rgba(0,0,0,0.5)' };

export default React.memo(FamilyTree3D);
