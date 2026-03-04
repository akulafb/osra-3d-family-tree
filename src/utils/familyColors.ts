/**
 * Shared family cluster color palette and helpers.
 */

export const FAMILY_COLORS: Record<string, string> = {
  Badran: '#0066ff',
  Kutob: '#00ff88',
  Hajjaj: '#ffaa00',
  Zabalawi: '#ff00aa',
  Malhis: '#aa00ff',
  Shawa: '#ff3333',
  Dajani: '#33ffff',
  Masri: '#ffff33',
  Tamimi: '#00ff00',
  Husaini: '#ff0000',
  Nabulsi: '#ff6600',
  Ghazali: '#00ccff',
  Rifai: '#cc00ff',
  Qudsi: '#66ff00',
  Jaabari: '#ff0066',
  Khalidi: '#00ffcc',
};

const COLOR_VALUES = Object.values(FAMILY_COLORS);

function hashCluster(cluster: string): number {
  let hash = 0;
  for (let i = 0; i < cluster.length; i++) {
    hash = cluster.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash;
}

export function getClusterColor(
  cluster: string | undefined | null,
  defaultColor = '#ffffff'
): string {
  if (!cluster) return defaultColor;
  if (FAMILY_COLORS[cluster]) return FAMILY_COLORS[cluster];
  return COLOR_VALUES[Math.abs(hashCluster(cluster)) % COLOR_VALUES.length];
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
}

function isLight(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return false;
  const [r, g, b] = rgb;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6;
}

export function getClusterColors(cluster: string | undefined | null): {
  bg: string;
  border: string;
  text: string;
} {
  if (!cluster) {
    return { bg: 'rgba(100, 100, 100, 0.2)', border: '#888', text: '#fff' };
  }
  const hex = getClusterColor(cluster, '#888');
  const rgb = hexToRgb(hex);
  const bg = rgb
    ? `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.15)`
    : 'rgba(100, 100, 100, 0.2)';
  return {
    bg,
    border: hex,
    text: isLight(hex) ? '#000' : '#fff',
  };
}
