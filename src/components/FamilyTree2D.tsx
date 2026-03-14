import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { useSpring, animated } from 'react-spring';
import { select } from 'd3-selection';
import { zoom, zoomIdentity, ZoomBehavior } from 'd3-zoom';
import type { D3ZoomEvent } from 'd3-zoom';
import 'd3-transition'; // Import for transition support
import Button from '@mui/material/Button';
import { FamilyGraph, FamilyNode, Node2D, LayoutType } from '../types/graph';
import { calculateLayout, calculateBounds } from '../lib/layoutEngine';
import { NodeCard } from './NodeCard';
import { OrthogonalLinks } from './OrthogonalLinks';
import { getNodeId } from '../utils/getNodeId';
import { getClusterColor } from '../utils/familyColors';
import { filterGraphData } from '../lib/filterGraphData';
import { TreeSearchBar } from './TreeSearchBar';

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
  onSetCollapsedNodes?: (nodes: Set<string>) => void;
  onModeChange?: (mode: '3D' | '2D') => void;
  uniqueClusters: string[];
  onPresetSelect: (preset: string | null) => void;
  isMobile?: boolean;
  userNodeId?: string | null;
  onFindMeRequest?: (userCluster: string) => void;
  searchHighlightedNodeId?: string | null;
  searchQuery?: string;
  onSearchQueryChange?: (q: string) => void;
  searchMatches?: FamilyNode[];
  searchIndex?: number;
  onSearchPrev?: () => void;
  onSearchNext?: () => void;
  onSearchClose?: () => void;
  searchOpenRequested?: number;
  searchNavigateTrigger?: number;
  searchDisabled?: boolean;
}

function ExpandableSpring({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) {
  const spring = useSpring({
    maxHeight: isOpen ? 400 : 0,
    opacity: isOpen ? 1 : 0,
    config: { tension: 300, friction: 30 },
  });
  return (
    <animated.div style={{ ...spring, overflow: 'hidden' }}>
      {children}
    </animated.div>
  );
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
  onSetCollapsedNodes,
  onModeChange,
  uniqueClusters,
  onPresetSelect,
  isMobile = false,
  userNodeId = null,
  onFindMeRequest,
  searchHighlightedNodeId = null,
  searchQuery = '',
  onSearchQueryChange,
  searchMatches = [],
  searchIndex = 0,
  onSearchPrev,
  onSearchNext,
  onSearchClose,
  searchOpenRequested = 0,
  searchNavigateTrigger = 0,
  searchDisabled = false,
}) => {
  const presetBackground = 'linear-gradient(180deg, #f8fbff 0%, #eef4fb 100%)';
  const emptyBackground = 'linear-gradient(180deg, #f4f7fb 0%, #e7eef8 100%)';
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const zoomBehaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const pendingFindMeRef = useRef<string | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [isPresetMenuOpen, setIsPresetMenuOpen] = useState(false);
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= 768
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = () => setIsMobileViewport(mq.matches);
    handler();
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

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
    const fittedScale = Math.min(
      rect.width / (bounds.width + 100),
      rect.height / (bounds.height + 100),
      1.2
    );
    const scale = Math.max(0.35, fittedScale);

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

  // Focus on specific node (scale 1.25 for subtle "Find me!" zoom; duration in ms)
  const FOCUS_DURATION = 1040;
  const SEARCH_FOCUS_DURATION = 2080;

  const focusNode = useCallback((nodeId: string, scale = 1.2, durationMs = FOCUS_DURATION) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node || !svgRef.current || !zoomBehaviorRef.current) return;

    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();

    // D3 zoom: point (px, py) → (x + px*k, y + py*k). To center node at viewport:
    const targetTransform = zoomIdentity
      .translate(rect.width / 2 - node.x * scale, rect.height / 2 - node.y * scale)
      .scale(scale);

    select(svg)
      .transition()
      .duration(durationMs)
      .call(zoomBehaviorRef.current.transform as any, targetTransform);
  }, [nodes]);

  // Handle "Find me!" click: switch preset if needed, pan/zoom, temporary glow
  const handleFindMe = useCallback(() => {
    if (!userNodeId) return;
    const userNode = graphData.nodes.find(n => n.id === userNodeId);
    if (!userNode) return;
    const userCluster = userNode.familyCluster ?? userNode.maternalFamilyCluster ?? null;

    if (!activePreset || (userCluster && activePreset !== userCluster)) {
      if (userCluster) onFindMeRequest?.(userCluster);
    }

    setHighlightedNodeId(userNodeId);
    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedNodeId(null);
      highlightTimeoutRef.current = null;
    }, 3500);

    if (nodes.some(n => n.id === userNodeId)) {
      focusNode(userNodeId, 1.25, FOCUS_DURATION);
    } else {
      pendingFindMeRef.current = userNodeId;
    }
  }, [userNodeId, graphData.nodes, activePreset, onFindMeRequest, nodes, focusNode]);

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    };
  }, []);

  // Focus when user's node appears after preset switch
  useEffect(() => {
    const pending = pendingFindMeRef.current;
    if (!pending || !nodes.some(n => n.id === pending)) return;
    pendingFindMeRef.current = null;
    focusNode(pending, 1.25, FOCUS_DURATION);
  }, [nodes, focusNode]);

  // Expand settings when Ctrl+F opens search
  useEffect(() => {
    if (searchOpenRequested > 0) {
      setShowControls(true);
    }
  }, [searchOpenRequested]);

  // Navigate only when arrow is clicked or Enter pressed (not when typing)
  const prevSearchNavigateTrigger = useRef(0);
  useEffect(() => {
    if (searchNavigateTrigger > prevSearchNavigateTrigger.current) {
      prevSearchNavigateTrigger.current = searchNavigateTrigger;
      if (searchHighlightedNodeId && nodes.some(n => n.id === searchHighlightedNodeId)) {
        focusNode(searchHighlightedNodeId, 1.2, SEARCH_FOCUS_DURATION);
      }
    }
  }, [searchNavigateTrigger, searchHighlightedNodeId, nodes, focusNode]);

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
    const nodeId = node.id;
    if (!nodeId) return;

    const hasChildren = graphData.links.some(l => {
      const sId = getNodeId(l.source);
      return sId === nodeId && l.type === 'parent';
    });

    if (hasChildren) {
      if (onToggleCollapse) {
        onToggleCollapse(nodeId);
      } else {
        // Internal toggle if no parent provided
        onSetCollapsedNodes?.(new Set(collapsedNodes.has(nodeId)
          ? [...collapsedNodes].filter(id => id !== nodeId)
          : [...collapsedNodes, nodeId]
        ));
      }
    }

    onNodeDoubleClick?.(node as any);
  }, [graphData.links, onNodeDoubleClick, onToggleCollapse, onSetCollapsedNodes, collapsedNodes]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: activePreset ? presetBackground : emptyBackground }}>
      {!activePreset ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          color: '#1f2937',
          fontSize: '1rem',
          textAlign: 'center',
          padding: '24px',
        }}>
          <div style={{ maxWidth: '320px' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>🌳</div>
            {isMobile ? (
              <>
                <div style={{ marginBottom: '12px', lineHeight: 1.5 }}>
                  Select a family above to explore, or try the <strong>3D view</strong>.
                </div>
                {isMobileViewport && (
                  <div style={{ fontSize: '0.9rem', color: '#475569', lineHeight: 1.5 }}>
                    Visit on desktop for the full immersive experience.
                  </div>
                )}
              </>
            ) : (
              <div>Select a family above to view in 2D</div>
            )}
          </div>
        </div>
      ) : (
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          style={{
            background: activePreset ? presetBackground : emptyBackground,
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
                activePreset={activePreset}
                isHighlighted={highlightedNodeId === node.id}
                isSearchHighlighted={searchHighlightedNodeId === node.id}
              />
            ))}
          </g>

          {/* Zoom controls overlay */}
          <g style={{ pointerEvents: 'none' }}>
            <rect x="10" y="10" width="120" height="40" rx="8" fill="rgba(255,255,255,0.85)" />
            <text x="20" y="35" fill="#334155" fontSize={12}>
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
            <Button
              variant="contained"
              color="secondary"
              onClick={() => setIsPresetMenuOpen(!isPresetMenuOpen)}
              sx={{ width: '100%', justifyContent: 'space-between' }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activePreset || 'Select Family'}
              </span>
              {isPresetMenuOpen ? '▴' : '▾'}
            </Button>

            <ExpandableSpring isOpen={isPresetMenuOpen}>
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
                    <Button
                      key={cluster}
                      fullWidth
                      size="small"
                      onClick={() => {
                        onPresetSelect(cluster);
                        setIsPresetMenuOpen(false);
                      }}
                      sx={{
                        justifyContent: 'space-between',
                        color: activePreset === cluster ? (getClusterColor(cluster) || 'primary.main') : 'inherit',
                        backgroundColor: activePreset === cluster ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                      }}
                    >
                      {cluster}
                      {activePreset === cluster && '✓'}
                    </Button>
                  ))}
                </div>
              </div>
            </ExpandableSpring>
          </div>
        )}

        {/* Settings Toggle */}
        <Button
          variant="contained"
          color="primary"
          onClick={() => setShowControls(!showControls)}
          sx={{ width: '180px', minWidth: '180px' }}
        >
          Settings ⚙️ {showControls ? '▴' : '▾'}
        </Button>

        <ExpandableSpring isOpen={showControls}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            width: '180px',
            backgroundColor: 'rgba(30, 30, 40, 0.95)',
            padding: '12px',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.1)',
          }}>
            {userNodeId && (
              <Button variant="contained" color="success" size="small" onClick={handleFindMe}>
                Find me!
              </Button>
            )}

            {onModeChange && (
              <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                <Button variant="outlined" size="small" onClick={() => onModeChange('3D')} sx={{ flex: 1 }}>
                  🌌 3D
                </Button>
                <Button variant="contained" color="primary" size="small" onClick={() => onModeChange('2D')} sx={{ flex: 1 }}>
                  🌳 2D
                </Button>
              </div>
            )}

            {onSearchQueryChange && onSearchPrev && onSearchNext && onSearchClose && (
              <div style={{
                marginTop: '8px',
                marginBottom: '8px',
                padding: '12px',
                backgroundColor: 'rgba(0, 0, 0, 0.25)',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.12)',
              }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#888', marginBottom: '8px' }}>
                  Search
                </div>
                <TreeSearchBar
                  query={searchQuery}
                  onQueryChange={onSearchQueryChange}
                  matches={searchMatches}
                  currentIndex={searchIndex}
                  onPrev={onSearchPrev}
                  onNext={onSearchNext}
                  onClose={onSearchClose}
                  disabled={searchDisabled}
                  embedded
                  focusTrigger={searchOpenRequested}
                />
              </div>
            )}

            <Button
              variant="contained"
              color="error"
              size="small"
              onClick={() => {
                if (collapsedNodes.size > 0) {
                  onSetCollapsedNodes?.(new Set());
                } else {
                  const parents = new Set<string>();
                  graphData?.links.forEach(l => {
                    if (l.type === 'parent') {
                      const sId = getNodeId(l.source);
                      parents.add(sId);
                    }
                  });
                  onSetCollapsedNodes?.(parents);
                }
              }}
            >
              {collapsedNodes.size > 0 ? 'Expand All' : 'Collapse All'}
            </Button>
          </div>
        </ExpandableSpring>
      </div>
    </div>
  );
};

export default React.memo(FamilyTree2D);
