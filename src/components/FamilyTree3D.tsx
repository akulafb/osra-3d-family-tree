// src/components/FamilyTree3D.tsx

import React, { useCallback, useRef, useState, useEffect } from 'react';
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

const FamilyTree3D: React.FC = () => {
  const ForceGraph3DAny = ForceGraph3D as unknown as React.ComponentType<any>;
  const { graphData, isLoading: dataLoading, error: dataError, refetch } = useFamilyData();
  const { user, userProfile } = useAuth();
  
  const fgRef = useRef<any>();
  const [initialCameraPos, setInitialCameraPos] = useState<{ x: number; y: number; z: number } | null>(null);
  const [isSimulationLoading, setIsSimulationLoading] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [selectedNode, setSelectedNode] = useState<FamilyNode | null>(null);
  const [canEditSelected, setCanEditSelected] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isBulkInviteOpen, setIsBulkInviteOpen] = useState(false);

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
    const camera = fgRef.current.camera();
    const controls = fgRef.current.controls();
    if (!camera || !controls) return;

    const nodeData = node as any;
    setSelectedNode(node);
    
    const nodePos = new THREE.Vector3(nodeData.x || 0, nodeData.y || 0, nodeData.z || 0);
    const distance = 120;
    
    const direction = new THREE.Vector3().subVectors(camera.position, nodePos).normalize();
    const targetPos = new THREE.Vector3().addVectors(nodePos, direction.multiplyScalar(distance));

    const duration = 800;
    const startTime = Date.now();
    const startPos = camera.position.clone();
    const startTarget = controls.target.clone();

    const animate = () => {
      const progress = Math.min((Date.now() - startTime) / duration, 1);
      const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      camera.position.lerpVectors(startPos, targetPos, eased);
      controls.target.lerpVectors(startTarget, nodePos, eased);
      camera.lookAt(controls.target);
      camera.updateProjectionMatrix();

      if (progress < 1) requestAnimationFrame(animate);
    };
    animate();
  }, []);

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
    const isSelected = selectedNode?.id === node.id;
    const sprite = new SpriteText(node.name);
    sprite.color = node.familyCluster === 'Badran' ? '#3b82f6' : 
                   node.familyCluster === 'Kutob' ? '#10b981' : 
                   node.familyCluster === 'Hajjaj' ? '#f59e0b' :
                   node.familyCluster === 'Zabalawi' ? '#ec4899' :
                   node.familyCluster === 'Malhis' ? '#8b5cf6' : '#f59e0b';
    sprite.textHeight = 8;
    
    const group = new THREE.Group();
    const shadow = new THREE.Mesh(new THREE.SphereGeometry(2, 8, 8), new THREE.MeshStandardMaterial({ color: sprite.color, transparent: true, opacity: 0.1, emissive: sprite.color, emissiveIntensity: 0.2 }));
    shadow.castShadow = true;
    group.add(shadow);
    
    if (isSelected) {
      const aura = new THREE.Mesh(new THREE.SphereGeometry(14, 16, 16), new THREE.MeshBasicMaterial({ color: sprite.color, transparent: true, opacity: 0.2, wireframe: true }));
      const glow = new THREE.Mesh(new THREE.SphereGeometry(18, 16, 16), new THREE.MeshBasicMaterial({ color: sprite.color, transparent: true, opacity: 0.05 }));
      group.add(aura); group.add(glow);
    }
    group.add(sprite);
    return group;
  }, [selectedNode]);

  const resetView = useCallback(() => {
    if (!fgRef.current || !initialCameraPos) return;
    const camera = fgRef.current.camera();
    const controls = fgRef.current.controls();
    if (!camera || !controls) return;
    const duration = 1000;
    const startTime = Date.now();
    const startPos = camera.position.clone();
    const startTarget = controls.target.clone();
    const animate = () => {
      const progress = Math.min((Date.now() - startTime) / duration, 1);
      const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      camera.position.lerpVectors(startPos, new THREE.Vector3(initialCameraPos.x, initialCameraPos.y, initialCameraPos.z), eased);
      controls.target.lerpVectors(startTarget, new THREE.Vector3(0, 0, 0), eased);
      camera.lookAt(controls.target);
      camera.updateProjectionMatrix();
      if (progress < 1) requestAnimationFrame(animate);
    };
    animate();
  }, [initialCameraPos]);

  useEffect(() => {
    if (fgRef.current && !initialCameraPos) {
      const camera = fgRef.current.camera();
      if (camera) setInitialCameraPos({ x: camera.position.x, y: camera.position.y, z: camera.position.z });
    }
  }, [initialCameraPos]);

  const isLoading = dataLoading || isSimulationLoading;
  const error = dataError || validationError;

  // Debug: Check for missing env vars
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

  if (error) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100vh', background: '#0a0a0a', color: '#ef4444', textAlign: 'center' }}><div><h2>Error Loading Family Tree</h2><p>{error}</p></div></div>;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: 'radial-gradient(ellipse at center, #1a3a52 0%, #0a0a0a 100%)' }}>
      {isLoading && <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0, 0, 0, 0.7)', zIndex: 1000, color: '#fff', fontSize: '18px' }}><div style={{ textAlign: 'center' }}><div>Loading Family Tree...</div><div style={{ width: '40px', height: '40px', border: '4px solid rgba(255,255,255,0.3)', borderTop: '4px solid #fff', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '10px auto' }} /></div></div>}
      
      <ForceGraph3DAny
        graphData={graphData || { nodes: [], links: [] }}
        nodeThreeObject={nodeThreeObject}
        linkDistance={(l: any) => l.type === 'marriage' ? 200 : 40}
        linkStrength={(l: any) => l.type === 'marriage' ? 0.3 : 0.8}
        ref={fgRef}
        nodeRepulsion={8000}
        cooldownTicks={200}
        onEngineStop={() => setIsSimulationLoading(false)}
        onSceneReady={useCallback((scene: THREE.Scene) => {
          const renderer = fgRef.current?.renderer();
          if (renderer) { renderer.shadowMap.enabled = true; renderer.setClearColor(0x000000, 0); }
          scene.fog = new THREE.Fog(0x0a0a0a, 250, 1400);
        }, [])}
        onNodeClick={handleNodeClick}
        linkColor={(l: any) => l.type === 'marriage' ? '#f59e0b' : '#60a5fa'}
        linkWidth={(l: any) => l.type === 'marriage' ? 3 : 1.5}
        linkCurvature={(l: any) => l.type === 'marriage' ? 0.3 : 0}
        linkDirectionalArrowLength={(l: any) => l.type === 'parent' ? 8 : 0}
        linkDirectionalArrowColor={() => '#60a5fa'}
        backgroundColor="rgba(0,0,0,0)"
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

      <div style={{ position: 'absolute', top: '20px', right: '20px', display: 'flex', flexDirection: 'column', gap: '10px', zIndex: 10 }}>
        <button onClick={() => { setIsSimulationLoading(true); fgRef.current?.d3Force('charge')?.restart(); }} style={topBtnStyle('#3b82f6')}>Restart Simulation</button>
        <button onClick={resetView} style={topBtnStyle('#10b981')}>Reset View</button>
      </div>
      
      <div style={legendStyle}>
        <div style={{ marginBottom: '4px', color: isSteeringActive ? '#10b981' : '#f59e0b' }}>
          <strong>E</strong>: Mouse Steering ({isSteeringActive ? 'ACTIVE' : 'LOCKED'})
        </div>
        <div style={{ marginBottom: '4px' }}><strong>WASD</strong>: Move (Hold <strong>Shift</strong> for Boost)</div>
        <div style={{ marginBottom: '4px' }}><strong>Tab</strong>: Cycle Names</div>
        <div style={{ marginBottom: '4px' }}><strong>Enter</strong>: Focus selection</div>
        <div><strong>Esc</strong>: Deselect</div>
      </div>
    </div>
  );
};

const panelStyle: React.CSSProperties = { position: 'absolute', bottom: '40px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'rgba(42, 42, 42, 0.9)', padding: '15px 25px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 100, boxShadow: '0 4px 15px rgba(0,0,0,0.5)', border: '1px solid #444' };
const btnStyle = (bg: string, border = 'none') => ({ padding: '8px 16px', backgroundColor: bg, color: 'white', border: border === 'none' ? 'none' : `1px solid ${border}`, borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' as const });
const topBtnStyle = (bg: string) => ({ padding: '10px 20px', backgroundColor: bg, color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' as const });
const legendStyle: React.CSSProperties = { position: 'absolute', bottom: '20px', right: '20px', backgroundColor: 'rgba(0, 0, 0, 0.5)', padding: '10px', borderRadius: '8px', color: '#ccc', fontSize: '0.75rem', pointerEvents: 'none', zIndex: 10, border: '1px solid rgba(255, 255, 255, 0.1)' };

export default React.memo(FamilyTree3D);
