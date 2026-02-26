/**
 * WebP support detection and texture path resolution.
 * Use WebP when supported for smaller payloads.
 */
let _supportsWebP: boolean | null = null;

export function supportsWebP(): boolean {
  if (_supportsWebP !== null) return _supportsWebP;
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    _supportsWebP = canvas.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    _supportsWebP = false;
  }
  return _supportsWebP;
}

/**
 * Returns the best texture path (WebP or fallback).
 * e.g. '/planet-textures/earth.jpg' → '/planet-textures/earth.webp' (if supported) or same path
 */
export function getTexturePath(fullPath: string): string {
  const base = fullPath.replace(/\.[^.]+$/, '');
  const ext = fullPath.match(/\.[^.]+$/)?.[0]?.slice(1) || 'jpg';
  return supportsWebP() ? `${base}.webp` : `${base}.${ext}`;
}

