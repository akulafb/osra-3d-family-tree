import * as THREE from 'three';

/**
 * Creates a procedural star texture using a 2D canvas.
 * This generates a soft circular radial gradient.
 */
function createStarTexture(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 32, 32);

  const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.8)');
  gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.2)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 32, 32);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Simple pseudo-random noise function for cloud generation
 */
function noise(x: number, y: number): number {
  const sin = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return sin - Math.floor(sin);
}

/**
 * Smooth noise using bilinear interpolation
 */
function smoothNoise(x: number, y: number): number {
  const i = Math.floor(x);
  const j = Math.floor(y);
  const fx = x - i;
  const fy = y - j;

  const a = noise(i, j);
  const b = noise(i + 1, j);
  const c = noise(i, j + 1);
  const d = noise(i + 1, j + 1);

  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);

  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

/**
 * Fractal Brownian Motion for cloud-like detail
 */
function fbm(x: number, y: number, octaves: number = 4): number {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;

  for (let i = 0; i < octaves; i++) {
    value += amplitude * smoothNoise(x * frequency, y * frequency);
    amplitude *= 0.5;
    frequency *= 2;
  }

  return value;
}

/**
 * Creates a procedural nebula texture using fractal noise and radial gradients.
 * Generates soft, wispy cloud formations with a bright center that fades outward.
 */
function createNebulaTexture(
  innerColor: THREE.Color,
  midColor: THREE.Color,
  outerColor: THREE.Color
): THREE.Texture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Create ImageData for pixel manipulation
  const imageData = ctx.createImageData(size, size);
  const data = imageData.data;

  const centerX = size / 2;
  const centerY = size / 2;
  const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);

  // Generate noise texture with radial falloff
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const normalizedDist = dist / (size * 0.5);

      // Create wispy patterns using FBM
      const scale = 0.003;
      const noise1 = fbm(x * scale, y * scale, 5);
      const noise2 = fbm(x * scale * 2 + 100, y * scale * 2 + 100, 3);
      const combinedNoise = (noise1 + noise2 * 0.5) / 1.5;

      // Radial falloff with wispy edges
      const radialFalloff = Math.pow(1 - Math.min(normalizedDist, 1), 1.5);
      const wispyEdge = combinedNoise * radialFalloff;

      // Color mixing based on distance and noise
      const t = combinedNoise * radialFalloff;

      let r: number, g: number, b: number;

      if (t > 0.6) {
        // Inner bright region
        const blend = (t - 0.6) / 0.4;
        r = innerColor.r * 255 * blend + midColor.r * 255 * (1 - blend);
        g = innerColor.g * 255 * blend + midColor.g * 255 * (1 - blend);
        b = innerColor.b * 255 * blend + midColor.b * 255 * (1 - blend);
      } else if (t > 0.2) {
        // Mid region
        const blend = (t - 0.2) / 0.4;
        r = midColor.r * 255 * blend + outerColor.r * 255 * (1 - blend);
        g = midColor.g * 255 * blend + outerColor.g * 255 * (1 - blend);
        b = midColor.b * 255 * blend + outerColor.b * 255 * (1 - blend);
      } else {
        // Outer wispy region
        const alpha = t / 0.2;
        r = outerColor.r * 255 * alpha;
        g = outerColor.g * 255 * alpha;
        b = outerColor.b * 255 * alpha;
      }

      // Apply wispy edge distortion
      const edgeAlpha = Math.pow(wispyEdge, 0.7);

      const idx = (y * size + x) * 4;
      data[idx] = Math.min(255, r);
      data[idx + 1] = Math.min(255, g);
      data[idx + 2] = Math.min(255, b);
      data[idx + 3] = edgeAlpha * 255; // Alpha
    }
  }

  ctx.putImageData(imageData, 0, 0);

  // Apply some post-processing blur for softness
  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'blur(2px)';
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = size;
  tempCanvas.height = size;
  const tempCtx = tempCanvas.getContext('2d')!;
  tempCtx.drawImage(canvas, 0, 0);
  ctx.clearRect(0, 0, size, size);
  ctx.filter = 'none';
  ctx.drawImage(tempCanvas, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Creates a volumetric nebula using multiple layered planes for depth
 */
function createVolumetricNebula(
  innerColor: THREE.Color,
  midColor: THREE.Color,
  outerColor: THREE.Color,
  position: { x: number; y: number; z: number },
  scale: number,
  id: string
): { group: THREE.Group; id: string; pulsePhase: number; rotationSpeed: number } {
  const group = new THREE.Group();
  group.position.set(position.x, position.y, position.z);

  // Create multiple layers for volumetric effect
  const layers = 4;
  for (let i = 0; i < layers; i++) {
    const texture = createNebulaTexture(innerColor, midColor, outerColor);

    // Slightly vary colors per layer for depth
    const hueShift = (i / layers) * 0.05;
    const innerHSL = { h: 0, s: 0, l: 0 };
    innerColor.getHSL(innerHSL);

    const geometry = new THREE.PlaneGeometry(scale * (1 + i * 0.1), scale * (1 + i * 0.1), 1, 1);

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.25 - i * 0.03,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });

    const mesh = new THREE.Mesh(geometry, material);

    // Offset each layer slightly in Z for depth
    mesh.position.z = i * 50;
    mesh.rotation.z = (i / layers) * Math.PI * 0.5;

    group.add(mesh);
  }

  // Random initial rotation for variety
  group.rotation.z = Math.random() * Math.PI * 2;

  return {
    group,
    id,
    pulsePhase: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() * 0.02 + 0.01) * (Math.random() > 0.5 ? 1 : -1),
  };
}

export interface NebulaData {
  group: THREE.Group;
  id: string;
  pulsePhase: number;
  rotationSpeed: number;
}

export interface StarfieldResult {
  group: THREE.Group;
  nebulae: NebulaData[];
}

export function createStarfield(scene: THREE.Scene): StarfieldResult {
  const starfieldGroup = new THREE.Group();
  const textureLoader = new THREE.TextureLoader();

  // 1. Distant Background Sphere (Deep Space)
  const skyGeo = new THREE.SphereGeometry(10000, 64, 64);
  const skyMat = new THREE.MeshBasicMaterial({
    side: THREE.BackSide,
    toneMapped: false,
    color: new THREE.Color(0x00050a), // Almost black but slightly blue
  });
  const skySphere = new THREE.Mesh(skyGeo, skyMat);
  starfieldGroup.add(skySphere);

  // Load the stars texture for the distant sphere
  textureLoader.load('/planet-textures/stars.jpg', (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    skyMat.map = texture;
    skyMat.color.set(0xffffff); // Use full texture brightness
    skyMat.needsUpdate = true;
  });

  // 2. Volumetric Particle Layer (Near/Mid Parallax)
  const starCount = 4000;
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);

  const innerRadius = 1000;
  const outerRadius = 4000;

  for (let i = 0; i < starCount; i++) {
    const i3 = i * 3;

    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const distance = innerRadius + Math.random() * (outerRadius - innerRadius);

    positions[i3] = distance * Math.sin(phi) * Math.cos(theta);
    positions[i3 + 1] = distance * Math.sin(phi) * Math.sin(theta);
    positions[i3 + 2] = distance * Math.cos(phi);

    // High intensity colors
    const type = Math.random();
    if (type > 0.9) {
      colors[i3] = 1.2; colors[i3 + 1] = 1.4; colors[i3 + 2] = 2.0;
    } else if (type > 0.8) {
      colors[i3] = 2.0; colors[i3 + 1] = 2.0; colors[i3 + 2] = 1.4;
    } else {
      colors[i3] = 1.5; colors[i3 + 1] = 1.5; colors[i3 + 2] = 1.5;
    }
  }

  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const starMaterial = new THREE.PointsMaterial({
    size: 15,
    vertexColors: true,
    map: createStarTexture(),
    transparent: true,
    opacity: 1.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
    toneMapped: false,
  });

  const stars = new THREE.Points(starGeometry, starMaterial);
  starfieldGroup.add(stars);

  // 3. Nebulae - Volumetric clouds at different depths
  const nebulae: NebulaData[] = [];

  // Nebula 1: Blue/Cyan - positioned to the left, further back
  const blueNebula = createVolumetricNebula(
    new THREE.Color(0.4, 0.8, 1.0),   // Bright cyan core
    new THREE.Color(0.2, 0.4, 0.8),   // Mid blue
    new THREE.Color(0.05, 0.1, 0.3),  // Dark blue edge
    { x: -3500, y: 300, z: -4500 },
    3000,
    'blue-nebula'
  );
  starfieldGroup.add(blueNebula.group);
  nebulae.push(blueNebula);

  // Nebula 2: Purple/Magenta - positioned to the right, closer
  const purpleNebula = createVolumetricNebula(
    new THREE.Color(0.9, 0.4, 1.0),   // Bright purple core
    new THREE.Color(0.6, 0.2, 0.8),   // Mid purple
    new THREE.Color(0.2, 0.05, 0.3),  // Dark purple edge
    { x: 3000, y: -200, z: -3000 },
    2800,
    'purple-nebula'
  );
  starfieldGroup.add(purpleNebula.group);
  nebulae.push(purpleNebula);

  scene.add(starfieldGroup);

  return { group: starfieldGroup, nebulae };
}
