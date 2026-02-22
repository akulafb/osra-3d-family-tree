import React, { useState, useCallback, useMemo } from 'react';
import FamilyTree3D from './FamilyTree3D';
import { FamilyTree2D } from './FamilyTree2D';
import { useViewMode } from '../hooks/useViewMode';
import { useFamilyData } from '../hooks/useFamilyData';
import { FamilyNode } from '../types/graph';

export const FamilyTree: React.FC = () => {
  const { mode, switchMode, isHydrated } = useViewMode();
  const { graphData, isLoading, error, refetch } = useFamilyData();

  const [selectedNode, setSelectedNode] = useState<FamilyNode | null>(null);
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  const [activePreset, setActivePreset] = useState<string | null>(null);

  // Get unique family clusters
  const uniqueClusters = useMemo(() => {
    if (!graphData?.nodes) return [];
    const clusters = new Set<string>();
    graphData.nodes.forEach(n => {
      if (n.familyCluster) clusters.add(n.familyCluster);
    });
    return Array.from(clusters).sort();
  }, [graphData]);

  const handleNodeSelect = useCallback((node: FamilyNode) => {
    setSelectedNode(prev => prev?.id === node.id ? null : node);
  }, []);

  const handleBackgroundClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const handleToggleCollapse = useCallback((nodeId: string) => {
    setCollapsedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const handleModeChange = useCallback((newMode: '3D' | '2D') => {
    switchMode(newMode);
  }, [switchMode]);

  const handlePresetSelect = useCallback((preset: string | null) => {
    setActivePreset(preset);
  }, []);

  if (!isHydrated || isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100vh',
        background: '#0a0a0a',
        color: '#fff',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div>Loading Family Tree...</div>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid rgba(255,255,255,0.3)',
            borderTop: '4px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '16px auto',
          }} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100vh',
        background: '#0a0a0a',
        color: '#ef4444',
        textAlign: 'center',
        padding: '20px',
      }}>
        <div>
          <h2>Error Loading Family Tree</h2>
          <p>{error}</p>
          <button
            onClick={() => refetch()}
            style={{
              marginTop: '16px',
              padding: '10px 20px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!graphData || graphData.nodes.length === 0) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100vh',
        background: '#0a0a0a',
        color: '#fff',
        textAlign: 'center',
      }}>
        <div>
          <h2>No Family Data</h2>
          <p>No family members found in the database.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100vh',
      overflow: 'hidden',
      background: '#0a0a0a',
    }}>
      {/* No global controls here, each view handles its own */}

      {/* Selected Node Info - Bottom Center */}
      {selectedNode && (
        <div style={{
          position: 'absolute',
          bottom: '40px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(30, 30, 40, 0.95)',
          padding: '16px 24px',
          borderRadius: '12px',
          zIndex: 100,
          boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,255,255,0.1)',
          maxWidth: '300px',
          textAlign: 'center',
        }}>
          <div style={{
            fontWeight: 'bold',
            fontSize: '1.1rem',
            color: 'white',
            marginBottom: '4px',
          }}>
            {selectedNode.name}
          </div>
          {selectedNode.familyCluster && (
            <div style={{
              fontSize: '0.85rem',
              color: '#888',
              textTransform: 'uppercase',
              letterSpacing: '1px',
            }}>
              {selectedNode.familyCluster} Family
            </div>
          )}
          <button
            onClick={() => setSelectedNode(null)}
            style={{
              marginTop: '12px',
              padding: '6px 14px',
              backgroundColor: 'transparent',
              color: '#888',
              border: '1px solid #444',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.75rem',
            }}
          >
            Close
          </button>
        </div>
      )}

      {/* Main View Content */}
      <div style={{
        width: '100%',
        height: '100%',
      }}>
        {mode === '3D' ? (
          <FamilyTree3D
            graphData={graphData}
            selectedNode={selectedNode}
            onNodeSelect={handleNodeSelect}
            onBackgroundClick={handleBackgroundClick}
            collapsedNodes={collapsedNodes}
            onToggleCollapse={handleToggleCollapse}
            onModeChange={handleModeChange}
          />
        ) : (
          <FamilyTree2D
            graphData={graphData}
            layoutType="tree"
            activePreset={activePreset}
            selectedNodeId={selectedNode?.id || null}
            onNodeSelect={handleNodeSelect}
            onBackgroundClick={handleBackgroundClick}
            collapsedNodes={collapsedNodes}
            onToggleCollapse={handleToggleCollapse}
            onModeChange={handleModeChange}
            uniqueClusters={uniqueClusters}
            onPresetSelect={handlePresetSelect}
          />
        )}
      </div>
    </div>
  );
};

export default FamilyTree;
