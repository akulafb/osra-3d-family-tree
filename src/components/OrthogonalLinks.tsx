import React from 'react';
import { Link2D } from '../types/graph';

interface OrthogonalLinksProps {
  links: Link2D[];
  activePreset?: string | null;
}

// Family colors matching the 3D view
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

const getClusterColor = (cluster: string | undefined | null): string => {
  if (!cluster) return '#60a5fa';
  if (familyColors[cluster]) return familyColors[cluster];

  // Deterministic fallback
  const colors = Object.values(familyColors);
  let hash = 0;
  for (let i = 0; i < cluster.length; i++) {
    hash = cluster.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

export const OrthogonalLinks: React.FC<OrthogonalLinksProps> = ({
  links,
  activePreset,
}) => {
  return (
    <g className="links-layer">
      {links.map((link, index) => {
        const isInActiveCluster = activePreset &&
          link.source.familyCluster === activePreset &&
          link.target.familyCluster === activePreset;

        const isMarriage = link.type === 'marriage';

        // Marriage links are gold, parent links use family color or blue
        const baseColor = isMarriage
          ? '#f59e0b'
          : getClusterColor(link.source.familyCluster);

        const strokeWidth = isMarriage ? 2.5 : 1.5;
        const opacity = isMarriage ? 0.8 : 0.6;

        // Dim links not in the active preset
        const finalOpacity = activePreset && !isInActiveCluster && !isMarriage
          ? 0.15
          : opacity;

        return (
          <path
            key={`${link.source.id}-${link.target.id}-${index}`}
            d={link.path}
            stroke={baseColor}
            strokeWidth={strokeWidth}
            fill="none"
            opacity={finalOpacity}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transition: 'opacity 0.3s ease',
            }}
          />
        );
      })}
    </g>
  );
};

export default React.memo(OrthogonalLinks);
