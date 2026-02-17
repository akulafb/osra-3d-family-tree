import { useMemo, useRef } from 'react';
import * as THREE from 'three';

export interface StarLayer {
  count: number;
  size: number;
  opacity: number;
  depthRange: [number, number]; // [minZ, maxZ]
  speedMultiplier: number;
  color: THREE.Color;
}

export interface StarfieldConfig {
  layers: StarLayer[];
  ambientDriftSpeed: number;
  scrollSpeedMultiplier: number;
}

export interface StarData {
  positions: Float32Array;
  sizes: Float32Array;
  colors: Float32Array;
  velocities: Float32Array;
}

const DEFAULT_LAYERS: StarLayer[] = [
  {
    count: 300, // Reduced from 2000
    size: 1.2, // Slightly bigger than far-away stars
    opacity: 0.9,
    depthRange: [-30, 40],
    speedMultiplier: 2.0,
    color: new THREE.Color(0xffffff),
  },
  {
    count: 200, // Reduced from 1500
    size: 0.8,
    opacity: 0.7,
    depthRange: [-60, 10],
    speedMultiplier: 1.2,
    color: new THREE.Color(0xcceeff),
  },
  {
    count: 150, // Reduced from 1000
    size: 0.5,
    opacity: 0.5,
    depthRange: [-120, -30],
    speedMultiplier: 0.6,
    color: new THREE.Color(0xffddcc),
  },
  {
    count: 100, // Reduced from 800
    size: 0.3,
    opacity: 0.4,
    depthRange: [-250, -80],
    speedMultiplier: 0.2,
    color: new THREE.Color(0xccccff),
  },
];

const DEFAULT_CONFIG: StarfieldConfig = {
  layers: DEFAULT_LAYERS,
  ambientDriftSpeed: 0.5,
  scrollSpeedMultiplier: 50,
};

export function useStarfield(config: Partial<StarfieldConfig> = {}) {
  const finalConfig = useMemo(() => ({
    ...DEFAULT_CONFIG,
    ...config,
    layers: config.layers || DEFAULT_LAYERS,
  }), [config]);

  // Generate star data for each layer
  const starLayers = useMemo(() => {
    return finalConfig.layers.map((layer) => {
      const positions = new Float32Array(layer.count * 3);
      const sizes = new Float32Array(layer.count);
      const colors = new Float32Array(layer.count * 3);
      const velocities = new Float32Array(layer.count * 3);

      const [minZ, maxZ] = layer.depthRange;
      const zRange = maxZ - minZ;

      for (let i = 0; i < layer.count; i++) {
        const i3 = i * 3;

        // Random position in a cylinder/tube shape
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * 30 + 5; // Cylinder radius 5-35

        positions[i3] = Math.cos(angle) * radius; // x
        positions[i3 + 1] = Math.sin(angle) * radius; // y
        positions[i3 + 2] = minZ + Math.random() * zRange; // z

        // Size varies slightly within layer
        sizes[i] = layer.size * (0.8 + Math.random() * 0.4);

        // Color with slight variation
        const colorVariation = 0.1;
        colors[i3] = layer.color.r + (Math.random() - 0.5) * colorVariation;
        colors[i3 + 1] = layer.color.g + (Math.random() - 0.5) * colorVariation;
        colors[i3 + 2] = layer.color.b + (Math.random() - 0.5) * colorVariation;

        // Velocity for ambient drift (mostly forward in -z direction)
        velocities[i3] = (Math.random() - 0.5) * 0.02; // x drift
        velocities[i3 + 1] = (Math.random() - 0.5) * 0.02; // y drift
        velocities[i3 + 2] = -(0.02 + Math.random() * 0.03); // z drift (forward)
      }

      return {
        layer,
        data: { positions, sizes, colors, velocities },
      };
    });
  }, [finalConfig.layers]);

  // Refs for mutable state in animation loop
  const scrollProgressRef = useRef(0);
  const scrollVelocityRef = useRef(0);
  const lastScrollRef = useRef(0);

  const updateScroll = (progress: number) => {
    const delta = progress - lastScrollRef.current;
    scrollVelocityRef.current = delta;
    scrollProgressRef.current = progress;
    lastScrollRef.current = progress;
  };

  const getScrollVelocity = () => scrollVelocityRef.current;
  const getScrollProgress = () => scrollProgressRef.current;

  return {
    starLayers,
    config: finalConfig,
    updateScroll,
    getScrollVelocity,
    getScrollProgress,
  };
}

export type UseStarfieldReturn = ReturnType<typeof useStarfield>;
