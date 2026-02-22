import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { select } from 'd3-selection';
import { zoom, zoomIdentity, ZoomBehavior } from 'd3-zoom';
import type { D3ZoomEvent } from 'd3-zoom';
import 'd3-transition'; // Import for transition support
import { FamilyGraph, FamilyNode, Node2D, LayoutType } from '../types/graph';
import { calculateLayout, calculateBounds } from '../lib/layoutEngine';
import { NodeCard } from './NodeCard';
import { OrthogonalLinks } from './OrthogonalLinks';

interface FamilyTree2DProps {
  graphData: FamilyGraph;
  layoutType: LayoutType;
  activePreset?: string | null;
  selectedNodeId: string | null;
  onNodeSelect: (node: FamilyNode) => void;
  onNodeDoubleClick?: (node: FamilyNode) => void;
  onBackgroundClick?: () => void;
  collapsedNodes?: Set<string>;
  onToggleCollapse?: (nodeId: string) => void;
  onModeChange?: (mode: '3D' | '2D') => void;
  uniqueClusters: string[];
  onPresetSelect: (preset: string | null) => void;
}

// Family colors for UI
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

// Filter graph data based on collapsed nodes and active preset
function filterGraphData(
  graphData: FamilyGraph,
  collapsedNodes: Set<string>,
  activePreset?: string | null
): FamilyGraph {
  // First filter by preset (cluster)
  let nodes = graphData.nodes;
  let links = graphData.links;

  if (activePreset) {
    nodes = nodes.filter(n => n.familyCluster === activePreset);
    const nodeIds = new Set(nodes.map(n => n.id));
    links = links.filter(l => {
      const sourceId = typeof l.source === 'object' ? (l.source as any).id : l.source;
      const targetId = typeof l.target === 'object' ? (l.target as any).id : l.target;
      return nodeIds.has(sourceId) && nodeIds.has(targetId);
    });
  }

  // Then filter by collapsed nodes
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

  collapsedNodes.forEach(id => {
    getDescendants(id).forEach(dId => hiddenNodes.add(dId));
  });

  return {
    nodes: nodes.filter(n => !hiddenNodes.has(n.id)),
    links: links.filter(l => {
      const sourceId = typeof l.source === 'object' ? (l.source as any).id : l.source;
      const targetId = typeof l.target === 'object' ? (l.target as any).id : l.target;
      return !hiddenNodes.has(sourceId) && !hiddenNodes.has(targetId);
    }),
  };
}

export const FamilyTree2D: React.FC<FamilyTree2DProps> = ({
  graphData,
  layoutType,
  activePreset,
  selectedNodeId,
  onNodeSelect,
  onNodeDoubleClick,
  onBackgroundClick,
  collapsedNodes = new Set(),
  onToggleCollapse,
  onModeChange,
  uniqueClusters,
  onPresetSelect,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const zoomBehaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [isPresetMenuOpen, setIsPresetMenuOpen] = useState(false);

  // Filter graph data by preset and collapsed nodes
  const filteredGraphData = useMemo(() => {
    if (!activePreset) return { nodes: [], links: [] };
    return filterGraphData(graphData, collapsedNodes, activePreset);
  }, [graphData, collapsedNodes, activePreset]);

  // Calculate layout
  const { nodes, links } = useMemo(() => {
    if (filteredGraphData.nodes.length === 0) return { nodes: [], links: [] };
    return calculateLayout(
      filteredGraphData.nodes,
      filteredGraphData.links,
      layoutType
    );
  }, [filteredGraphData, layoutType]);

  // Calculate bounds and center the view
  const bounds = useMemo(() => calculateBounds(nodes), [nodes]);

  // Setup zoom behavior
  useEffect(() => {
    if (!svgRef.current) return;

    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('start', () => setIsDragging(true))
      .on('zoom', (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
        setTransform(event.transform);
      })
      .on('end', () => setIsDragging(false));

    zoomBehaviorRef.current = zoomBehavior;

    const selection = select(svgRef.current);
    selection.call(zoomBehavior as any);

    return () => {
      selection.on('.zoom', null);
    };
  }, [activePreset]); // Re-attach zoom behavior when SVG is rendered after preset selection

  // Center view when data changes significantly
  useEffect(() => {
    if (!svgRef.current || !bounds || nodes.length === 0) return;

    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();

    // Calculate center position
    const scale = Math.min(
      rect.width / (bounds.width + 100),
      rect.height / (bounds.height + 100),
      1.5 // Max initial zoom
    );

    const centerX = rect.width / 2 - (bounds.minX + bounds.width / 2) * scale;
    const centerY = rect.height / 2 - (bounds.minY + bounds.height / 2) * scale;

    // Apply initial transform
    const initialTransform = zoomIdentity.translate(centerX, centerY).scale(scale);

    if (zoomBehaviorRef.current) {
      select(svgRef.current)
        .call(zoomBehaviorRef.current.transform as any, initialTransform);
    }
  }, [bounds, nodes.length === 0]); // Only re-center on initial load or empty state

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab' && nodes.length > 0) {
        e.preventDefault();

        const currentIndex = selectedNodeId
          ? nodes.findIndex(n => n.id === selectedNodeId)
          : -1;

        const nextIndex = e.shiftKey
          ? currentIndex <= 0 ? nodes.length - 1 : currentIndex - 1
          : (currentIndex + 1) % nodes.length;

        const nextNode = nodes[nextIndex];
        onNodeSelect(nextNode);

        // Pan to the selected node
        if (svgRef.current && zoomBehaviorRef.current) {
          const svg = svgRef.current;
          const rect = svg.getBoundingClientRect();

          const targetTransform = zoomIdentity
            .translate(rect.width / 2 - nextNode.x * transform.k, rect.height / 2 - nextNode.y * transform.k)
            .scale(transform.k);

          select(svg)
            .transition()
            .duration(300)
            .call(zoomBehaviorRef.current.transform as any, targetTransform);
        }
      } else if (e.key === 'Escape') {
        onBackgroundClick?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nodes, selectedNodeId, onNodeSelect, onBackgroundClick, transform.k]);

  // Focus on specific node
  const focusNode = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node || !svgRef.current || !zoomBehaviorRef.current) return;

    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();

    const targetTransform = zoomIdentity
      .translate(rect.width / 2 - node.x, rect.height / 2 - node.y)
      .scale(1.2);

      select(svg)
        .transition()
        .duration(500)
        .call(zoomBehaviorRef.current.transform as any, targetTransform);
  }, [nodes]);

  // Expose focus method via ref if needed
  useEffect(() => {
    // Store focus function on the component for external access
    (FamilyTree2D as any).focusNode = focusNode;
  }, [focusNode]);

  // Handle background click
  const handleBackgroundClick = useCallback((e: React.MouseEvent) => {
    if (e.target === svgRef.current || e.target === gRef.current) {
      onBackgroundClick?.();
    }
  }, [onBackgroundClick]);

  // Handle node click with proper selection
  const handleNodeClick = useCallback((node: Node2D) => {
    onNodeSelect(node);
  }, [onNodeSelect]);

  // Handle node double click for collapse toggle
  const handleNodeDoubleClick = useCallback((node: Node2D) => {
    const hasChildren = graphData.links.some(l => {
      const sourceId = typeof l.source === 'object' ? (l.source as any).id : l.source;
      return sourceId === node.id && l.type === 'parent';
    });

    if (hasChildren && onToggleCollapse) {
      onToggleCollapse(node.id);
    }

    onNodeDoubleClick?.(node);
  }, [graphData.links, onNodeDoubleClick, onToggleCollapse]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: !activePreset ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' : '#0a0a0a' }}>
      {!activePreset ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          color: '#fff',
          fontSize: '1.5rem',
          textAlign: 'center',
        }}>
          <div>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🌳</div>
            <div>Select a family above to view in 2D</div>
          </div>
        </div>
      ) : (
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          style={{
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
            cursor: isDragging ? 'grabbing' : 'grab',
          }}
          onClick={handleBackgroundClick}
        >
          {/* Define filters for shadow effects */}
          <defs>
            <filter id="cardShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.3" />
            </filter>
          </defs>

          {/* Transform group for zoom/pan */}
          <g
            ref={gRef}
            transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}
          >
            {/* Render links first (behind nodes) */}
            <OrthogonalLinks links={links} activePreset={activePreset} />

            {/* Render nodes */}
            {nodes.map(node => (
              <NodeCard
                key={node.id}
                node={node}
                isSelected={selectedNodeId === node.id}
                onClick={handleNodeClick}
                onDoubleClick={handleNodeDoubleClick}
              />
            ))}
          </g>

          {/* Zoom controls overlay */}
          <g style={{ pointerEvents: 'none' }}>
            <rect x="10" y="10" width="120" height="40" rx="8" fill="rgba(0,0,0,0.5)" />
            <text x="20" y="35" fill="#888" fontSize={12}>
              Zoom: {(transform.k * 100).toFixed(0)}%
            </text>
          </g>
        </svg>
      )}

      {/* 2D Controls Overlay - Top Right */}
      <div style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        zIndex: 10,
        alignItems: 'flex-end',
      }}>
        {/* Family Preset Selector */}
        {uniqueClusters.length > 0 && (
          <div style={{ width: '180px' }}>
            <button
              onClick={() => setIsPresetMenuOpen(!isPresetMenuOpen)}
              style={{
                width: '100%',
                padding: '8px 16px',
                backgroundColor: activePreset ? familyColors[activePreset] || '#8b5cf6' : '#444',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '6px',
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activePreset || 'Select Family'}
              </span>
              <span style={{ fontSize: '0.7rem' }}>▾</span>
            </button>

            {isPresetMenuOpen && (
              <div style={{
                marginTop: '4px',
                backgroundColor: 'rgba(30, 30, 40, 0.98)',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                width: '100%',
                overflow: 'hidden',
              }}>
                <div style={{
                  padding: '10px 16px 6px',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  color: '#888',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                }}>
                  Families
                </div>

                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {uniqueClusters.map(cluster => (
                    <button
                      key={cluster}
                      onClick={() => {
                        onPresetSelect(cluster);
                        setIsPresetMenuOpen(false);
                      }}
                      style={{
                        padding: '10px 16px',
                        backgroundColor: activePreset === cluster ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                        color: activePreset === cluster ? (familyColors[cluster] || '#60a5fa') : '#e5e7eb',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        textAlign: 'left',
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>{cluster}</span>
                      {activePreset === cluster && <span>✓</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Settings Toggle */}
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
            width: '180px',
          }}
        >
          Settings ⚙️
        </button>

        {showControls && (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '6px', 
            width: '180px', 
            backgroundColor: 'rgba(30, 30, 40, 0.95)', 
            padding: '12px', 
            borderRadius: '8px', 
            border: '1px solid rgba(255,255,255,0.1)' 
          }}>
            {/* 3D/2D Toggle */}
            {onModeChange && (
              <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                <button
                  onClick={() => onModeChange('3D')}
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
                  🌌 3D
                </button>
                <button
                  onClick={() => onModeChange('2D')}
                  style={{ 
                    flex: 1,
                    padding: '6px 12px', 
                    backgroundColor: '#8b5cf6', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '4px', 
                    cursor: 'pointer', 
                    fontSize: '0.75rem',
                    fontWeight: 600,
                  }}
                >
                  🌳 2D
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(FamilyTree2D);
