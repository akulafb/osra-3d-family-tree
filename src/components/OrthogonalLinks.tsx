import React from 'react';
import { Link2D } from '../types/graph';
import { getClusterColor } from '../utils/familyColors';

interface OrthogonalLinksProps {
  links: Link2D[];
  activePreset?: string | null;
}

export const OrthogonalLinks: React.FC<OrthogonalLinksProps> = ({
  links,
  activePreset,
}) => {
  return (
    <g className="links-layer">
      {links.map((link, index) => {
        const isInActiveCluster = activePreset &&
          (link.source.familyCluster === activePreset || link.source.maternalFamilyCluster === activePreset) &&
          (link.target.familyCluster === activePreset || link.target.maternalFamilyCluster === activePreset);

        const isMarriage = link.type === 'marriage';
        const isDivorce = link.type === 'divorce';

        // Marriage links are gold, divorce links are gray, parent links use family color or blue
        const baseColor = isMarriage
          ? '#f59e0b'
          : (isDivorce ? '#9ca3af' : getClusterColor(link.source.familyCluster, '#60a5fa'));

        const strokeWidth = (isMarriage || isDivorce) ? 2.5 : 1.5;
        const opacity = (isMarriage || isDivorce) ? 0.8 : 0.6;

        // Dim links not in the active preset
        const finalOpacity = activePreset && !isInActiveCluster && !isMarriage && !isDivorce
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
            strokeDasharray={isDivorce ? "5,5" : "none"}
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
