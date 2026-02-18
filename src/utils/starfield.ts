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

export function createStarfield(scene: THREE.Scene): THREE.Group {
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
  const starCount = 4000; // Slightly fewer but brighter/bigger
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
    size: 15, // Bigger points
    vertexColors: true,
    map: createStarTexture(),
    transparent: true,
    opacity: 1.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
    toneMapped: false, // Prevent dimming by tone mapper
  });

  const stars = new THREE.Points(starGeometry, starMaterial);
  starfieldGroup.add(stars);

  scene.add(starfieldGroup);
  return starfieldGroup;
}
