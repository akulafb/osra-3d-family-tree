// src/components/FamilyTree3D.tsx

import React, { useCallback, useRef, useState, useEffect } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import SpriteText from 'three-spritetext';
import * as THREE from 'three';
import familyData from '../data/familyData.json';
import { FamilyGraph, FamilyNode, FamilyLink } from '../types/graph';

const FamilyTree3D: React.FC = () => {
  const ForceGraph3DAny = ForceGraph3D as unknown as React.ComponentType<any>;
  const graphData = familyData as FamilyGraph;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>();
  const [initialCameraPos, setInitialCameraPos] = useState<{ x: number; y: number; z: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Validate graph data
  useEffect(() => {
    try {
      if (!graphData || !graphData.nodes || !graphData.links) {
        setError('Invalid graph data: missing nodes or links');
        setIsLoading(false);
        return;
      }
      if (graphData.nodes.length === 0) {
        setError('No family members found in data');
        setIsLoading(false);
        return;
      }
      // Validate all links reference valid nodes
      const nodeIds = new Set(graphData.nodes.map(n => n.id));
      const invalidLinks = graphData.links.filter(
        l => !nodeIds.has(l.source) || !nodeIds.has(l.target)
      );
      if (invalidLinks.length > 0) {
        setError(`Invalid links found: ${invalidLinks.length} link(s) reference non-existent nodes`);
        setIsLoading(false);
        return;
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error loading data');
      setIsLoading(false);
    }
  }, [graphData]);

  // Store initial camera position for reset view
  useEffect(() => {
    if (fgRef.current && !initialCameraPos) {
      const camera = fgRef.current.camera();
      if (camera) {
        setInitialCameraPos({
          x: camera.position.x,
          y: camera.position.y,
          z: camera.position.z,
        });
      }
    }
  }, [initialCameraPos]);

  // Function to restart the simulation (useful for testing parameter changes)
  const restartSimulation = useCallback(() => {
    if (fgRef.current) {
      // Reset node positions and restart simulation
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fgRef.current.graphData().nodes.forEach((node: any) => {
        node.fx = undefined;
        node.fy = undefined;
        node.fz = undefined;
      });
      fgRef.current.d3Force('charge')?.restart();
    }
  }, []);

  // Click-to-focus: Smoothly animate camera to focus on clicked node
  const handleNodeClick = useCallback((node: FamilyNode) => {
    if (!fgRef.current) return;

    const camera = fgRef.current.camera();
    if (!camera) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nodeData = node as any;
    const nodePosition = {
      x: nodeData.x || 0,
      y: nodeData.y || 0,
      z: nodeData.z || 0,
    };

    // Calculate distance from camera to node
    const distance = Math.sqrt(
      Math.pow(camera.position.x - nodePosition.x, 2) +
      Math.pow(camera.position.y - nodePosition.y, 2) +
      Math.pow(camera.position.z - nodePosition.z, 2)
    );

    // Target camera position: offset from node to maintain viewing angle
    const offsetDistance = Math.max(distance * 0.5, 100); // Stay at reasonable distance
    const targetPosition = {
      x: nodePosition.x + offsetDistance * 0.5,
      y: nodePosition.y + offsetDistance * 0.5,
      z: nodePosition.z + offsetDistance * 0.5,
    };

    // Smooth camera animation using lerp
    const duration = 1000; // 1 second animation
    const startTime = Date.now();
    const startPos = {
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z,
    };

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (ease-in-out)
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      // Lerp camera position
      camera.position.x = startPos.x + (targetPosition.x - startPos.x) * eased;
      camera.position.y = startPos.y + (targetPosition.y - startPos.y) * eased;
      camera.position.z = startPos.z + (targetPosition.z - startPos.z) * eased;

      // Update camera look-at to focus on node
      camera.lookAt(nodePosition.x, nodePosition.y, nodePosition.z);
      camera.updateProjectionMatrix();

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }, []);

  // Reset view: Return camera to initial position
  const resetView = useCallback(() => {
    if (!fgRef.current || !initialCameraPos) return;

    const camera = fgRef.current.camera();
    if (!camera) return;

    const duration = 1000;
    const startTime = Date.now();
    const startPos = {
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z,
    };

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      camera.position.x = startPos.x + (initialCameraPos.x - startPos.x) * eased;
      camera.position.y = startPos.y + (initialCameraPos.y - startPos.y) * eased;
      camera.position.z = startPos.z + (initialCameraPos.z - startPos.z) * eased;

      camera.lookAt(0, 0, 0); // Look at center
      camera.updateProjectionMatrix();

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }, [initialCameraPos]);

  const nodeThreeObject = useCallback((node: FamilyNode) => {
    const sprite = new SpriteText(node.name);
    sprite.color = node.familyCluster === 'Badran' ? '#3b82f6' : 
                   node.familyCluster === 'Kutob' ? '#10b981' : 
                   node.familyCluster === 'Hajjaj' ? '#f59e0b' :
                   node.familyCluster === 'Zabalawi' ? '#ec4899' :
                   node.familyCluster === 'Malhis' ? '#8b5cf6' : '#f59e0b';
    sprite.textHeight = 8;
    
    // Enable shadows: SpriteText doesn't cast shadows directly, so add a shadow-casting sphere
    const group = new THREE.Group();
    
    // Add a small, subtle sphere that casts shadows (creates shadow on ground plane)
    const shadowSphere = new THREE.Mesh(
      new THREE.SphereGeometry(2, 8, 8), // Smaller sphere, fewer segments
      new THREE.MeshStandardMaterial({ 
        color: sprite.color,
        transparent: true,
        opacity: 0.1, // Very subtle, mostly invisible
        emissive: sprite.color,
        emissiveIntensity: 0.2
      })
    );
    shadowSphere.castShadow = true;
    shadowSphere.receiveShadow = false; // Don't receive shadows
    group.add(shadowSphere);
    group.add(sprite);
    
    return group;
  }, []);

  // Configure link distance: shorter for parent links (keep families close), 
  // longer for marriage links (bridge between clusters)
  const linkDistance = useCallback((link: FamilyLink) => {
    if (link.type === 'marriage') return 200; // Longer distance for marriage links
    if (link.type === 'parent') return 40;    // Shorter distance for parent links
    return 100; // Default fallback
  }, []);

  // Configure link strength: weaker for marriage links (flexible bridges),
  // stronger for parent links (tight family bonds)
  const linkStrength = useCallback((link: FamilyLink) => {
    if (link.type === 'marriage') return 0.3; // Weaker - allows flexibility
    if (link.type === 'parent') return 0.8;   // Stronger - keeps families tight
    return 0.5; // Default fallback
  }, []);

  // Style link colors: different colors for different link types
  const linkColor = useCallback((link: FamilyLink) => {
    if (link.type === 'marriage') return '#f59e0b'; // Orange/amber for marriage links (bridges)
    if (link.type === 'parent') return '#60a5fa';  // Light blue for parent links
    return '#9ca3af'; // Gray default
  }, []);

  // Style link width: thicker for marriage links to make them stand out
  const linkWidth = useCallback((link: FamilyLink) => {
    if (link.type === 'marriage') return 3; // Thicker for marriage links
    if (link.type === 'parent') return 1.5; // Thinner for parent links
    return 2; // Default
  }, []);

  // Add directional arrows for parent links (parent → child)
  const linkDirectionalArrowLength = useCallback((link: FamilyLink) => {
    if (link.type === 'parent') return 8; // Show arrows for parent links
    return 0; // No arrows for marriage links
  }, []);

  const linkDirectionalArrowColor = useCallback((link: FamilyLink) => {
    if (link.type === 'parent') return '#60a5fa'; // Match parent link color
    return '#000000';
  }, []);

  // Add curvature to marriage links to make them visually distinct (bridges)
  const linkCurvature = useCallback((link: FamilyLink) => {
    if (link.type === 'marriage') return 0.3; // Curved for marriage links (bridges)
    return 0; // Straight for parent links
  }, []);

  // Depth cue handled via fog and lattice; keep node opacity constant

  const handleSceneReady = useCallback((scene: THREE.Scene) => {
    const renderer = fgRef.current?.renderer();
    if (renderer) {
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.setClearColor(0x000000, 0);
    }
    // Depth cue via fog; color matches background gradient edge
    scene.fog = new THREE.Fog(0x0a0a0a, 250, 1400);

    // 3D lattice box for depth cues (non-interactive)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const oldLattice = (scene as any).latticeHelper;
    if (oldLattice) scene.remove(oldLattice);

    const size = 2000;
    const divisions = 10;
    const half = size / 2;
    const step = size / divisions;
    const vertices: number[] = [];

    for (let i = 0; i <= divisions; i += 1) {
      const p = -half + i * step;
      for (let j = 0; j <= divisions; j += 1) {
        const q = -half + j * step;

        // Lines parallel to X axis
        vertices.push(-half, p, q, half, p, q);
        // Lines parallel to Y axis
        vertices.push(p, -half, q, p, half, q);
        // Lines parallel to Z axis
        vertices.push(p, q, -half, p, q, half);
      }
    }

    const latticeGeometry = new THREE.BufferGeometry();
    latticeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    const latticeMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.25,
    });
    const lattice = new THREE.LineSegments(latticeGeometry, latticeMaterial);
    lattice.raycast = () => {};
    scene.add(lattice);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (scene as any).latticeHelper = lattice;
  }, []);


  // Error state
  if (error) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        background: 'radial-gradient(ellipse at center, #1a3a52 0%, #0a0a0a 100%)',
        color: '#ef4444',
        fontSize: '18px',
        textAlign: 'center',
        padding: '20px',
      }}>
        <div>
          <h2 style={{ marginBottom: '10px' }}>Error Loading Family Tree</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      position: 'relative', 
      width: '100%', 
      height: '100%',
      background: 'radial-gradient(ellipse at center, #1a3a52 0%, #0a0a0a 100%)',
    }}>
      {/* Loading overlay */}
      {isLoading && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0, 0, 0, 0.7)',
          zIndex: 1000,
          color: '#fff',
          fontSize: '18px',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: '10px' }}>Loading Family Tree...</div>
            <div style={{ 
              width: '40px', 
              height: '40px', 
              border: '4px solid rgba(255,255,255,0.3)',
              borderTop: '4px solid #fff',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto',
            }} />
          </div>
        </div>
      )}
      <ForceGraph3DAny
        graphData={graphData}
        nodeThreeObject={nodeThreeObject}
        linkDistance={linkDistance}
        linkStrength={linkStrength}
        ref={fgRef}
        nodeRepulsion={8000}
        cooldownTicks={200}
        onEngineStop={() => {
          setIsLoading(false); // Graph has finished initializing
        }}
        onSceneReady={handleSceneReady}
        onRenderFramePre={() => {
          const renderer = fgRef.current?.renderer();
          if (renderer) {
            renderer.setClearColor(0x000000, 0);
          }
        }}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onNodeDragEnd={(node: any) => {
          node.fx = node.x;
          node.fy = node.y;
          node.fz = node.z;
        }}
        onNodeClick={handleNodeClick}
        linkColor={linkColor}
        linkWidth={linkWidth}
        linkCurvature={linkCurvature}
        linkDirectionalArrowLength={linkDirectionalArrowLength}
        linkDirectionalArrowColor={linkDirectionalArrowColor}
        linkDirectionalParticles={2}
        linkDirectionalParticleSpeed={0.005}
        backgroundColor="rgba(0,0,0,0)"
        showNavInfo={true}
      />
      <div style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        zIndex: 10,
      }}>
        <button
          onClick={restartSimulation}
          aria-label="Restart force simulation"
          style={{
            padding: '10px 20px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#2563eb';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#3b82f6';
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              restartSimulation();
            }
          }}
        >
          Restart Simulation
        </button>
        <button
          onClick={resetView}
          aria-label="Reset camera to initial view"
          style={{
            padding: '10px 20px',
            backgroundColor: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#059669';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#10b981';
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              resetView();
            }
          }}
        >
          Reset View
        </button>
      </div>
    </div>
  );
};

// Memoize component to prevent unnecessary re-renders
export default React.memo(FamilyTree3D);