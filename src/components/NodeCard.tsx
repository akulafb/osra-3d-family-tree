import React from 'react';
import { Node2D } from '../types/graph';
import { getClusterColors } from '../utils/familyColors';

interface NodeCardProps {
  node: Node2D;
  isSelected: boolean;
  onClick: (node: Node2D) => void;
  onDoubleClick?: (node: Node2D) => void;
  /** When viewing a cluster, maternal-only children use lighter tint */
  activePreset?: string | null;
  /** Temporary glow for "Find me!" highlight */
  isHighlighted?: boolean;
  /** Search match highlight (bright red glow) */
  isSearchHighlighted?: boolean;
}

/** Lighten colors for maternal-only nodes (same hue, lighter tint) */
function lightenColors(base: { bg: string; border: string; text: string }) {
  // Parse hex to RGB and mix with white (60% white) for lighter tint
  const hexToRgb = (hex: string) => {
    const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
  };
  const rgb = hexToRgb(base.border);
  const lightBorder = rgb
    ? `rgb(${Math.round(rgb[0] * 0.4 + 255 * 0.6)}, ${Math.round(rgb[1] * 0.4 + 255 * 0.6)}, ${Math.round(rgb[2] * 0.4 + 255 * 0.6)})`
    : base.border;
  return {
    bg: base.bg.replace(/[\d.]+\)$/, '0.08)'),
    border: lightBorder,
    text: base.text,
  };
}

const HIGHLIGHT_GLOW_COLOR = '#10b981';
const SEARCH_GLOW_COLOR = '#ef4444';

export const NodeCard: React.FC<NodeCardProps> = ({
  node,
  isSelected,
  onClick,
  onDoubleClick,
  activePreset,
  isHighlighted = false,
  isSearchHighlighted = false,
}) => {
  const isMaternalOnly =
    activePreset &&
    node.maternalFamilyCluster === activePreset &&
    node.familyCluster !== activePreset;
  const baseColors = getClusterColors(
    isMaternalOnly ? activePreset : node.familyCluster
  );
  const colors = isMaternalOnly ? lightenColors(baseColors) : baseColors;

  const firstName = node.firstName.trim();
  const lastName = (node.familyCluster ?? '').trim();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick(node);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDoubleClick?.(node);
  };

  return (
    <g
      transform={`translate(${node.x - node.width / 2}, ${node.y})`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      style={{
        cursor: 'pointer',
      }}
      className={`node-card ${isSelected ? 'selected' : ''} ${isHighlighted ? 'highlighted' : ''} ${isSearchHighlighted ? 'search-highlighted' : ''}`}
    >
      {/* Search match highlight (red glow, takes precedence) */}
      {isSearchHighlighted && (
        <rect
          x={-10}
          y={-10}
          width={node.width + 20}
          height={node.height + 20}
          rx={16}
          fill="none"
          stroke={SEARCH_GLOW_COLOR}
          strokeWidth={4}
          opacity={0.8}
          style={{ transition: 'opacity 0.3s ease' }}
        />
      )}
      {/* Find me! highlight glow */}
      {isHighlighted && !isSearchHighlighted && (
        <rect
          x={-8}
          y={-8}
          width={node.width + 16}
          height={node.height + 16}
          rx={14}
          fill="none"
          stroke={HIGHLIGHT_GLOW_COLOR}
          strokeWidth={3}
          opacity={0.5}
          style={{ transition: 'opacity 0.3s ease' }}
        />
      )}

      {/* Card shadow */}
      <rect
        x={2}
        y={2}
        width={node.width}
        height={node.height}
        rx={8}
        fill="rgba(0, 0, 0, 0.3)"
      />

      {/* Main card */}
      <rect
        x={0}
        y={0}
        width={node.width}
        height={node.height}
        rx={8}
        fill={colors.bg}
        stroke={isSelected ? '#fff' : colors.border}
        strokeWidth={isSelected ? 3 : 2}
        style={{
          transition: 'all 0.2s ease',
        }}
      />

      {/* Selection glow effect */}
      {isSelected && (
        <rect
          x={-4}
          y={-4}
          width={node.width + 8}
          height={node.height + 8}
          rx={12}
          fill="none"
          stroke={colors.border}
          strokeWidth={2}
          opacity={0.3}
        />
      )}

      {/* First name */}
      <text
        x={node.width / 2}
        y={node.height / 2 - 2}
        textAnchor="middle"
        fill={colors.text}
        fontSize={12}
        fontWeight={600}
        style={{ pointerEvents: 'none' }}
      >
        {firstName.length > 14 ? firstName.slice(0, 13) + '...' : firstName}
      </text>

      {/* Last name */}
      {lastName && (
        <text
          x={node.width / 2}
          y={node.height / 2 + 16}
          textAnchor="middle"
          fill={colors.text}
          fontSize={11}
          opacity={0.9}
          style={{ pointerEvents: 'none' }}
        >
          {lastName.length > 14 ? lastName.slice(0, 13) + '...' : lastName}
        </text>
      )}

      {/* Cluster indicator dot */}
      <circle
        cx={node.width - 10}
        cy={10}
        r={4}
        fill={colors.border}
      />

      {/* Claimed tick (subtle) */}
      {node.isClaimed && (
        <text
          x={node.width - 10}
          y={node.height - 8}
          textAnchor="end"
          fill={colors.text}
          fontSize={10}
          opacity={0.7}
          style={{ pointerEvents: 'none' }}
        >
          ✓
        </text>
      )}
    </g>
  );
};

export default React.memo(NodeCard);
