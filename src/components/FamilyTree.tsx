import React, { useState, useCallback, useMemo, useEffect } from 'react';
import Button from '@mui/material/Button';
import FamilyTree3D from './FamilyTree3D';
import { FamilyTree2D } from './FamilyTree2D';
import { useViewMode } from '../hooks/useViewMode';
import { useFamilyData } from '../hooks/useFamilyData';
import { FamilyNode, FamilyLink } from '../types/graph';
import { useAuth } from '../contexts/AuthContext';
import { canEdit, canManageInvites } from '../lib/permissions';
import { filterGraphData, getVisibleNodes3D } from '../lib/filterGraphData';
import { searchNodes } from '../utils/treeSearch';
import AddRelativeModal from './modals/AddRelativeModal';
import EditNodeModal from './modals/EditNodeModal';
import BulkInviteModal from './modals/BulkInviteModal';
import { FamilyChat } from './FamilyChat';
import { isMobile } from '../utils/device';

export const FamilyTree: React.FC = () => {
  const { user, userProfile } = useAuth();
  const { mode, switchMode, isHydrated } = useViewMode();
  const { graphData, isLoading, error, refetch } = useFamilyData();

  const [selectedNode, setSelectedNode] = useState<FamilyNode | null>(null);
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  const [activePreset, setActivePreset] = useState<string | null>(null);
  
  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isBulkInviteOpen, setIsBulkInviteOpen] = useState(false);
  const [canEditSelected, setCanEditSelected] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchIndex, setSearchIndex] = useState(0);
  const [searchOpenRequested, setSearchOpenRequested] = useState(0);
  const [searchNavigateTrigger, setSearchNavigateTrigger] = useState(0);

  // Check permissions when node is selected
  useEffect(() => {
    if (selectedNode && user && graphData?.links && userProfile?.node_id) {
      const result = canEdit(selectedNode.id, userProfile.node_id, userProfile.role === 'admin', graphData.links as FamilyLink[]);
      setCanEditSelected(result);
    } else {
      setCanEditSelected(false);
    }
  }, [selectedNode, user, userProfile, graphData]);

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

  const handleSetCollapsedNodes = useCallback((nodes: Set<string>) => {
    setCollapsedNodes(nodes);
  }, []);

  const handleModeChange = useCallback((newMode: '3D' | '2D') => {
    switchMode(newMode);
  }, [switchMode]);

  const handlePresetSelect = useCallback((preset: string | null) => {
    setActivePreset(preset);
  }, []);

  const handleFindMeRequest = useCallback((userCluster: string) => {
    setActivePreset(userCluster);
  }, []);

  // Visible nodes for search (depends on mode)
  const visibleNodes = useMemo(() => {
    if (!graphData) return [];
    if (mode === '3D') {
      return getVisibleNodes3D(graphData, collapsedNodes);
    }
    const filtered = filterGraphData(graphData, collapsedNodes, activePreset);
    return filtered.nodes;
  }, [graphData, mode, collapsedNodes, activePreset]);

  const searchMatches = useMemo(
    () => searchNodes(visibleNodes, searchQuery),
    [visibleNodes, searchQuery]
  );

  const searchHighlightedNodeId = searchMatches[searchIndex]?.id ?? null;

  const handleSearchPrev = useCallback(() => {
    setSearchIndex((i) => (i <= 0 ? searchMatches.length - 1 : i - 1));
    setSearchNavigateTrigger((n) => n + 1);
  }, [searchMatches.length]);

  const handleSearchNext = useCallback(() => {
    setSearchIndex((i) => (i >= searchMatches.length - 1 ? 0 : i + 1));
    setSearchNavigateTrigger((n) => n + 1);
  }, [searchMatches.length]);

  const handleSearchClose = useCallback(() => {
    setSearchQuery('');
    setSearchIndex(0);
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      setSearchIndex(0);
    }
  }, [searchQuery]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setSearchOpenRequested((n) => n + 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!isHydrated || isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100vh',
          minHeight: '100vh',
          background: '#0a0a0a',
          color: '#fff',
        }}
        aria-busy="true"
        aria-live="polite"
      >
        <div style={{ textAlign: 'center', minWidth: '200px' }}>
          <div>Loading <span style={{ fontFamily: 'cursive', fontWeight: 'bold' }}>Osra</span> Family Tree...</div>
          <div
            style={{
              width: '40px',
              height: '40px',
              border: '4px solid rgba(255,255,255,0.3)',
              borderTop: '4px solid #3b82f6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '16px auto',
            }}
            role="status"
            aria-label="Loading"
          />
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
          <h2>Error Loading <span style={{ fontFamily: 'cursive', fontWeight: 'bold' }}>Osra</span> Family Tree</h2>
          <p>{error}</p>
          <Button variant="contained" color="primary" onClick={() => refetch()} sx={{ marginTop: '16px' }}>
            Retry
          </Button>
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
          minWidth: '280px',
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
              marginBottom: '4px',
            }}>
              {selectedNode.familyCluster} Family
            </div>
          )}
          <div style={{
            fontSize: '0.75rem',
            color: '#666',
            fontFamily: 'monospace',
            marginBottom: selectedNode.familyCluster ? '12px' : '8px',
          }}>
            {selectedNode.id}
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {canEditSelected && (
              <>
                <Button variant="contained" color="warning" size="small" onClick={() => setIsEditModalOpen(true)}>
                  Edit
                </Button>
                <Button variant="contained" color="primary" size="small" onClick={() => setIsAddModalOpen(true)}>
                  + Add
                </Button>
                {canManageInvites(selectedNode.id, userProfile?.node_id, userProfile?.role === 'admin', (graphData?.links ?? []) as FamilyLink[]) && (
                  <Button variant="contained" color="success" size="small" onClick={() => setIsBulkInviteOpen(true)}>
                    Invite
                  </Button>
                )}
              </>
            )}
            <Button variant="outlined" size="small" onClick={() => setSelectedNode(null)} sx={{ color: '#888', borderColor: '#444' }}>
              Close
            </Button>
          </div>
        </div>
      )}

      {/* Modals */}
      {selectedNode && (
        <>
          <AddRelativeModal 
            isOpen={isAddModalOpen} 
            onClose={() => setIsAddModalOpen(false)} 
            targetNode={selectedNode} 
            onSuccess={() => {}} 
            existingNodes={graphData?.nodes || []} 
          />
          <EditNodeModal 
            isOpen={isEditModalOpen} 
            onClose={() => setIsEditModalOpen(false)} 
            targetNode={selectedNode} 
            onSuccess={() => {}} 
            existingNodes={graphData?.nodes || []} 
          />
        </>
      )}
      {userProfile?.node_id && (
        <BulkInviteModal 
          isOpen={isBulkInviteOpen} 
          onClose={() => setIsBulkInviteOpen(false)} 
          allNodes={graphData?.nodes || []} 
          allLinks={graphData?.links ? [...graphData.links] : []} 
          userNodeId={userProfile.node_id} 
          inviteForNodeId={selectedNode && selectedNode.id !== userProfile.node_id && canManageInvites(selectedNode.id, userProfile.node_id, userProfile.role === 'admin', (graphData?.links ?? []) as FamilyLink[]) ? selectedNode.id : undefined}
          onSuccess={() => {}} 
        />
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
            onSetCollapsedNodes={handleSetCollapsedNodes}
            onModeChange={handleModeChange}
            isAddModalOpen={isAddModalOpen}
            isEditModalOpen={isEditModalOpen}
            isBulkInviteOpen={isBulkInviteOpen}
            searchHighlightedNodeId={searchHighlightedNodeId}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            searchMatches={searchMatches}
            searchIndex={searchIndex}
            onSearchPrev={handleSearchPrev}
            onSearchNext={handleSearchNext}
            onSearchClose={handleSearchClose}
            searchOpenRequested={searchOpenRequested}
            searchNavigateTrigger={searchNavigateTrigger}
            searchDisabled={false}
          />
        ) : (
          <FamilyTree2D
            graphData={graphData}
            layoutType="tree"
            activePreset={activePreset}
            isMobile={isMobile()}
            selectedNodeId={selectedNode?.id || null}
            onNodeSelect={handleNodeSelect}
            onBackgroundClick={handleBackgroundClick}
            collapsedNodes={collapsedNodes}
            onToggleCollapse={handleToggleCollapse}
            onSetCollapsedNodes={handleSetCollapsedNodes}
            onModeChange={handleModeChange}
            uniqueClusters={uniqueClusters}
            onPresetSelect={handlePresetSelect}
            userNodeId={userProfile?.node_id ?? null}
            onFindMeRequest={handleFindMeRequest}
            searchHighlightedNodeId={searchHighlightedNodeId}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            searchMatches={searchMatches}
            searchIndex={searchIndex}
            onSearchPrev={handleSearchPrev}
            onSearchNext={handleSearchNext}
            onSearchClose={handleSearchClose}
            searchOpenRequested={searchOpenRequested}
            searchNavigateTrigger={searchNavigateTrigger}
            searchDisabled={!activePreset}
          />
        )}
      </div>

      {/* Family Chat Bot */}
      <FamilyChat />
    </div>
  );
};

export default FamilyTree;
