import React from 'react';
import { Node2D } from '../types/graph';

interface NodeCardProps {
  node: Node2D;
  isSelected: boolean;
  onClick: (node: Node2D) => void;
  onDoubleClick?: (node: Node2D) => void;
}

// Family colors matching the 3D view
const familyColors: Record<string, { bg: string; border: string; text: string }> = {
  'Badran': { bg: 'rgba(0, 102, 255, 0.15)', border: '#0066ff', text: '#fff' },
  'Kutob': { bg: 'rgba(0, 255, 136, 0.15)', border: '#00ff88', text: '#fff' },
  'Hajjaj': { bg: 'rgba(255, 170, 0, 0.15)', border: '#ffaa00', text: '#fff' },
  'Zabalawi': { bg: 'rgba(255, 0, 170, 0.15)', border: '#ff00aa', text: '#fff' },
  'Malhis': { bg: 'rgba(170, 0, 255, 0.15)', border: '#aa00ff', text: '#fff' },
  'Shawa': { bg: 'rgba(255, 51, 51, 0.15)', border: '#ff3333', text: '#fff' },
  'Dajani': { bg: 'rgba(51, 255, 255, 0.15)', border: '#33ffff', text: '#000' },
  'Masri': { bg: 'rgba(255, 255, 51, 0.15)', border: '#ffff33', text: '#000' },
  'Tamimi': { bg: 'rgba(0, 255, 0, 0.15)', border: '#00ff00', text: '#000' },
  'Husaini': { bg: 'rgba(255, 0, 0, 0.15)', border: '#ff0000', text: '#fff' },
  'Nabulsi': { bg: 'rgba(255, 102, 0, 0.15)', border: '#ff6600', text: '#fff' },
  'Ghazali': { bg: 'rgba(0, 204, 255, 0.15)', border: '#00ccff', text: '#000' },
  'Rifai': { bg: 'rgba(204, 0, 255, 0.15)', border: '#cc00ff', text: '#fff' },
  'Qudsi': { bg: 'rgba(102, 255, 0, 0.15)', border: '#66ff00', text: '#000' },
  'Jaabari': { bg: 'rgba(255, 0, 102, 0.15)', border: '#ff0066', text: '#fff' },
  'Khalidi': { bg: 'rgba(0, 255, 204, 0.15)', border: '#00ffcc', text: '#000' },
};

const getClusterColors = (cluster: string | undefined | null) => {
  if (!cluster) {
    return { bg: 'rgba(100, 100, 100, 0.2)', border: '#888', text: '#fff' };
  }
  if (familyColors[cluster]) return familyColors[cluster];

  // Deterministic fallback
  const fallbackColors = Object.values(familyColors);
  let hash = 0;
  for (let i = 0; i < cluster.length; i++) {
    hash = cluster.charCodeAt(i) + ((hash << 5) - hash);
  }
  return fallbackColors[Math.abs(hash) % fallbackColors.length];
};

export const NodeCard: React.FC<NodeCardProps> = ({
  node,
  isSelected,
  onClick,
  onDoubleClick,
}) => {
  const colors = getClusterColors(node.familyCluster);

  // Split name for better display
  const nameParts = node.name.trim().split(' ');
  const firstName = nameParts.slice(0, -1).join(' ') || node.name;
  const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';

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
      className={`node-card ${isSelected ? 'selected' : ''}`}
    >
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
    </g>
  );
};

export default React.memo(NodeCard);
