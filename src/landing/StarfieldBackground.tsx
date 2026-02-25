import { useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars, Preload } from '@react-three/drei';
import { useSpring, type MotionValue } from 'motion/react';
import * as THREE from 'three';
import { useStarfield, StarLayer } from './useStarfield';

// Create a circular star texture using canvas
function createStarTexture(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  
  // Clear canvas
  ctx.clearRect(0, 0, 32, 32);
  
  // Create radial gradient for soft-edged star
  const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.9)');
  gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.4)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 32, 32);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

interface StarLayerProps {
  layer: StarLayer;
  positions: Float32Array;
  sizes: Float32Array;
  colors: Float32Array;
  velocities: Float32Array;
  scrollVelocity: React.MutableRefObject<number>;
  ambientDriftSpeed: number;
  scrollSpeedMultiplier: number;
}

function StarLayerPoints({
  layer,
  positions,
  sizes,
  colors,
  velocities,
  scrollVelocity,
  ambientDriftSpeed,
  scrollSpeedMultiplier,
}: StarLayerProps) {
  const meshRef = useRef<THREE.Points>(null);
  const geometryRef = useRef<THREE.BufferGeometry>(null);

  // Create buffer geometry once
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions.slice(), 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes.slice(), 1));
    geo.setAttribute('color', new THREE.BufferAttribute(colors.slice(), 3));
    return geo;
  }, [positions, sizes, colors]);

  // Create circular star texture
  const starTexture = useMemo(() => createStarTexture(), []);

  useFrame((_, delta) => {
    if (!meshRef.current || !geometryRef.current) return;

    const positionAttribute = geometryRef.current.attributes.position;
    const posArray = positionAttribute.array as Float32Array;
    const [minZ, maxZ] = layer.depthRange;

    // Calculate total speed: ambient + scroll-driven
    const scrollSpeed = scrollVelocity.current * scrollSpeedMultiplier * layer.speedMultiplier;
    const totalSpeed = (ambientDriftSpeed + Math.abs(scrollSpeed)) * delta;

    for (let i = 0; i < layer.count; i++) {
      const i3 = i * 3;

      // Apply ambient drift
      posArray[i3] += velocities[i3] * ambientDriftSpeed * delta;
      posArray[i3 + 1] += velocities[i3 + 1] * ambientDriftSpeed * delta;
      posArray[i3 + 2] += velocities[i3 + 2] * totalSpeed;

      // Wrap around z-axis when stars go too far
      if (posArray[i3 + 2] < minZ) {
        posArray[i3 + 2] = maxZ;
        // Randomize x,y again for variety
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * 30 + 5;
        posArray[i3] = Math.cos(angle) * radius;
        posArray[i3 + 1] = Math.sin(angle) * radius;
      }
    }

    positionAttribute.needsUpdate = true;
  });

  return (
    <points ref={meshRef} geometry={geometry}>
      <bufferGeometry ref={geometryRef} attach="geometry" {...geometry} />
      <pointsMaterial
        size={layer.size}
        vertexColors
        transparent
        opacity={layer.opacity}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        map={starTexture}
        alphaTest={0.01}
      />
    </points>
  );
}

interface CameraControllerProps {
  scrollYProgress: MotionValue<number>;
}

function CameraController({ scrollYProgress }: CameraControllerProps) {
  const { camera } = useThree();
  const lastProgress = useRef(0);
  const velocityRef = useRef(0);

  // Smooth the scroll progress
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  useFrame(() => {
    const progress = smoothProgress.get();
    const delta = progress - lastProgress.current;
    velocityRef.current = delta;
    lastProgress.current = progress;

    // Gentle camera drift — keep stars at consistent brightness
    const startZ = 10;
    const endZ = 5;
    const targetZ = startZ + (endZ - startZ) * progress;

    camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetZ, 0.05);

    // Slight camera rotation based on scroll for dynamism
    camera.rotation.z = progress * 0.05;
  });

  return null;
}

interface StarfieldSceneProps {
  scrollYProgress: MotionValue<number>;
}

function StarfieldScene({ scrollYProgress }: StarfieldSceneProps) {
  const { starLayers, config, updateScroll, getScrollVelocity } = useStarfield();
  const scrollVelocityRef = useRef(0);

  useFrame(() => {
    const progress = scrollYProgress.get();
    updateScroll(progress);
    scrollVelocityRef.current = getScrollVelocity();
  });

  return (
    <>
      <CameraController scrollYProgress={scrollYProgress} />

      {/* Ambient light for floating debris */}
      <ambientLight intensity={0.2} />
      <directionalLight position={[10, 10, 5]} intensity={0.5} />

      {/* Background stars from drei */}
      <Stars
        radius={300}
        depth={100}
        count={2000}
        factor={4}
        saturation={0.5}
        fade
        speed={0.5}
      />

      {/* Procedural star layers */}
      {starLayers.map(({ layer, data }, index) => (
        <StarLayerPoints
          key={index}
          layer={layer}
          positions={data.positions}
          sizes={data.sizes}
          colors={data.colors}
          velocities={data.velocities}
          scrollVelocity={scrollVelocityRef}
          ambientDriftSpeed={config.ambientDriftSpeed}
          scrollSpeedMultiplier={config.scrollSpeedMultiplier}
        />
      ))}

      <Preload all />
    </>
  );
}

interface StarfieldBackgroundProps {
  className?: string;
  scrollYProgress: MotionValue<number>;
}

export function StarfieldBackground({ className, scrollYProgress }: StarfieldBackgroundProps) {
  return (
    <div
      className={className}
      style={{
        position: 'sticky',
        top: 0,
        height: '100vh',
        width: '100%',
        overflow: 'hidden',
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 10], fov: 60 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        }}
        style={{
          width: '100%',
          height: '100%',
          background: 'transparent',
        }}
      >
        <StarfieldScene scrollYProgress={scrollYProgress} />
      </Canvas>
    </div>
  );
}

export default StarfieldBackground;
