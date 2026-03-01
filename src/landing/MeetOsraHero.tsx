import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { type MotionValue } from 'motion/react';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import styles from './MeetOsraHero.module.css';
import { landingHeroCopy } from './content';

interface MeetOsraHeroProps {
  onSignIn: () => void;
  scrollYProgress: MotionValue<number>;
}

interface EdgeObject {
  a: number;
  b: number;
  mid: THREE.Vector3;
  perp: THREE.Vector3;
  phase: number;
  speed: number;
  wobbleAmp: number;
  positions: Float32Array;
  coreOpacity: number;
  haloOpacity: number;
  updatePositions: () => void;
  setOpacity: (core: number, halo: number) => void;
  setVisible: (visible: boolean) => void;
  dispose: () => void;
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function createGlowTexture(inner: string, outer: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }

  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(0.35, outer);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function createStarTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }

  const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.3, 'rgba(255,255,255,0.92)');
  gradient.addColorStop(0.65, 'rgba(255,255,255,0.5)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 32, 32);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function createSeededRng(seedStart: number): () => number {
  let seed = seedStart >>> 0;
  return () => {
    seed ^= seed << 13;
    seed ^= seed >> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 0xffffffff;
  };
}

export function MeetOsraHero({ onSignIn, scrollYProgress }: MeetOsraHeroProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const welcomeRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const nodeCountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const rootEl = rootRef.current;
    const canvas = canvasRef.current;
    const welcomeEl = welcomeRef.current;
    const titleEl = titleRef.current;
    const bodyEl = bodyRef.current;
    const nodeCountEl = nodeCountRef.current;

    if (!rootEl || !canvas || !welcomeEl || !titleEl || !bodyEl || !nodeCountEl) return;

    const rng = createSeededRng(0xdeadbeef);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x07030f, 0.86);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x07030f, 0.012);

    const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 300);
    camera.position.set(0, 0, 4);

    const lineMaterials: LineMaterial[] = [];
    let viewportWidth = 1;
    let viewportHeight = 1;
    let isMobile = window.matchMedia('(max-width: 768px)').matches;

    const resize = () => {
      const rect = rootEl.getBoundingClientRect();
      viewportWidth = Math.max(1, rect.width);
      viewportHeight = Math.max(1, rect.height);

      renderer.setSize(viewportWidth, viewportHeight, false);
      camera.aspect = viewportWidth / viewportHeight;
      camera.updateProjectionMatrix();
      lineMaterials.forEach((material) => material.resolution.set(viewportWidth, viewportHeight));
    };

    resize();

    scene.add(new THREE.AmbientLight(0x1a0033, 2.2));
    const pl1 = new THREE.PointLight(0x9333ea, 5, 60);
    pl1.position.set(5, 6, 8);
    scene.add(pl1);
    const pl2 = new THREE.PointLight(0x7c3aed, 3, 50);
    pl2.position.set(-8, -3, 5);
    scene.add(pl2);
    const pl3 = new THREE.PointLight(0xd8b4fe, 2, 45);
    pl3.position.set(0, -8, -6);
    scene.add(pl3);

    const starsCount = 1100;
    const starPositions = new Float32Array(starsCount * 3);
    for (let i = 0; i < starsCount; i += 1) {
      const direction = new THREE.Vector3(rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1).normalize();
      const radius = rng() * 200;
      starPositions[i * 3] = direction.x * radius;
      starPositions[i * 3 + 1] = direction.y * radius;
      starPositions[i * 3 + 2] = direction.z * radius;
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starTexture = createStarTexture();
    const starMaterial = new THREE.PointsMaterial({
      color: 0xc4b5fd,
      size: 0.11,
      map: starTexture,
      transparent: true,
      opacity: 0.34,
      alphaTest: 0.5,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    const nodePositions: THREE.Vector3[] = [];
    let guard = 0;
    while (nodePositions.length < 50 && guard < 20000) {
      guard += 1;
      const rx = 4 + rng() * 13;
      const ry = 3.5 + rng() * 8;
      const rz = 2 + rng() * 6;
      const direction = new THREE.Vector3(rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1).normalize();

      const point = new THREE.Vector3(
        direction.x * rx,
        direction.y * ry * 0.55,
        direction.z * rz,
      );

      if (!nodePositions.some((existing) => existing.distanceTo(point) < 1.8)) {
        nodePositions.push(point);
      }
    }

    // No hard scaling needed — the Camera and rng distribution fill the frame naturally.

    const edgeDefs: Array<[number, number]> = [];
    const edgeSet = new Set<string>();
    nodePositions.forEach((position, index) => {
      nodePositions
        .map((candidate, candidateIndex) => ({ candidateIndex, distance: position.distanceTo(candidate) }))
        .filter((entry) => entry.candidateIndex !== index)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 2)
        .forEach(({ candidateIndex }) => {
          const key = `${Math.min(index, candidateIndex)}_${Math.max(index, candidateIndex)}`;
          if (!edgeSet.has(key)) {
            edgeSet.add(key);
            edgeDefs.push([index, candidateIndex]);
          }
        });
    });

    const adjacency = Array.from({ length: nodePositions.length }, () => [] as number[]);
    edgeDefs.forEach(([a, b]) => {
      adjacency[a].push(b);
      adjacency[b].push(a);
    });

    const nodeBaseColor = 0x6d28d9;
    const nodeHoverColor = 0xffb3ff;
    const nodeEmissiveColor = 0x3b0764;
    const purpleGlowTexture = createGlowTexture('rgba(196,181,253,0.95)', 'rgba(124,58,237,0.5)');
    const whiteGlowTexture = createGlowTexture('rgba(255,255,255,1.0)', 'rgba(220,200,255,0.6)');

    const graphGroup = new THREE.Group();
    graphGroup.position.y = 0.45;
    scene.add(graphGroup);

    const sphereGeometry = new THREE.SphereGeometry(0.32, 32, 32);
    const nodeMeshes: THREE.Mesh[] = [];
    const purpleGlows: THREE.Sprite[] = [];
    const whiteGlows: THREE.Sprite[] = [];
    const nodeVisible = new Array(nodePositions.length).fill(0);
    const hoverTarget = new Array(nodePositions.length).fill(0);
    const hoverCurrent = new Array(nodePositions.length).fill(0);

    nodePositions.forEach((position) => {
      const material = new THREE.MeshPhongMaterial({
        color: nodeBaseColor,
        emissive: nodeEmissiveColor,
        emissiveIntensity: 1.8,
        specular: 0xe9d5ff,
        shininess: 140,
        transparent: false,
        opacity: 1.0,
      });

      const mesh = new THREE.Mesh(sphereGeometry, material);
      mesh.position.copy(position);
      mesh.scale.setScalar(0);
      mesh.renderOrder = 6;

      const purpleGlow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: purpleGlowTexture,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          depthTest: true,
        }),
      );
      purpleGlow.position.copy(position);
      purpleGlow.scale.setScalar(1.3);
      purpleGlow.renderOrder = 4;

      const whiteGlow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: whiteGlowTexture,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          depthTest: true,
        }),
      );
      whiteGlow.position.copy(position);
      whiteGlow.scale.setScalar(2.2);
      whiteGlow.renderOrder = 5;

      // Keep layering deterministic: glows behind, solid mesh on top.
      graphGroup.add(purpleGlow);
      graphGroup.add(whiteGlow);
      graphGroup.add(mesh);
      purpleGlows.push(purpleGlow);
      whiteGlows.push(whiteGlow);
      nodeMeshes.push(mesh);
    });

    const segmentCount = 18;
    const edgeObjects: EdgeObject[] = [];
    const edgeHitLines: THREE.Line[] = [];

    edgeDefs.forEach(([a, b]) => {
      const pointA = nodePositions[a];
      const pointB = nodePositions[b];
      const midpoint = pointA.clone().lerp(pointB, 0.5);
      const edgeDirection = pointB.clone().sub(pointA).normalize();
      const randomAxis = new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize();
      const perp = edgeDirection.clone().cross(randomAxis);
      if (perp.lengthSq() < 1e-4) {
        perp.copy(edgeDirection.clone().cross(new THREE.Vector3(0, 1, 0)));
      }
      if (perp.lengthSq() < 1e-4) {
        perp.copy(edgeDirection.clone().cross(new THREE.Vector3(1, 0, 0)));
      }
      perp.normalize();
      const phase = rng() * Math.PI * 2;
      const speed = 0.25 + rng() * 0.4;
      const wobbleAmp = 0.08 + rng() * 0.12;
      const positions = new Float32Array((segmentCount + 1) * 3);

      const coreGeometry = new LineGeometry();
      const haloGeometry = new LineGeometry();
      coreGeometry.setPositions(positions);
      haloGeometry.setPositions(positions);

      const coreMaterial = new LineMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        linewidth: 2.5,
        blending: THREE.NormalBlending,
        dashed: false,
        depthTest: false,
        depthWrite: false,
      });
      const haloMaterial = new LineMaterial({
        color: 0xd8b4fe,
        transparent: true,
        opacity: 0,
        linewidth: 4.0,
        blending: THREE.AdditiveBlending,
        dashed: false,
        depthTest: false,
        depthWrite: false,
      });

      lineMaterials.push(coreMaterial, haloMaterial);
      coreMaterial.resolution.set(viewportWidth, viewportHeight);
      haloMaterial.resolution.set(viewportWidth, viewportHeight);

      const coreLine = new Line2(coreGeometry, coreMaterial);
      const haloLine = new Line2(haloGeometry, haloMaterial);
      coreLine.frustumCulled = false;
      haloLine.frustumCulled = false;
      coreLine.renderOrder = 0;
      haloLine.renderOrder = 1;
      graphGroup.add(haloLine);
      graphGroup.add(coreLine);

      // Line2 is not raycast-friendly by default; keep an invisible hit line in parallel.
      const hitGeometry = new THREE.BufferGeometry();
      const hitPositions = new Float32Array((segmentCount + 1) * 3);
      const hitAttribute = new THREE.BufferAttribute(hitPositions, 3);
      hitGeometry.setAttribute('position', hitAttribute);
      const hitMaterial = new THREE.LineBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: false,
      });
      const hitLine = new THREE.Line(hitGeometry, hitMaterial);
      hitLine.userData = { a, b };
      graphGroup.add(hitLine);
      edgeHitLines.push(hitLine);

      const edgeObject: EdgeObject = {
        a,
        b,
        mid: midpoint,
        perp,
        phase,
        speed,
        wobbleAmp,
        positions,
        coreOpacity: 0,
        haloOpacity: 0,
        updatePositions: () => {
          coreGeometry.setPositions(positions);
          haloGeometry.setPositions(positions);
          hitPositions.set(positions);
          hitAttribute.needsUpdate = true;
        },
        setOpacity: (coreOpacity, haloOpacity) => {
          coreMaterial.opacity = coreOpacity;
          haloMaterial.opacity = haloOpacity;
        },
        setVisible: (visible) => {
          coreLine.visible = visible;
          haloLine.visible = visible;
          hitLine.visible = visible;
        },
        dispose: () => {
          coreGeometry.dispose();
          haloGeometry.dispose();
          coreMaterial.dispose();
          haloMaterial.dispose();
          hitGeometry.dispose();
          hitMaterial.dispose();
        },
      };

      edgeObjects.push(edgeObject);
    });

    const bfsPath = [0];
    const visited = new Set<number>([0]);
    const queue = [0];

    while (queue.length > 0 && bfsPath.length < 5) {
      const current = queue.shift() as number;
      const neighbours = [...adjacency[current]];
      for (let i = neighbours.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        [neighbours[i], neighbours[j]] = [neighbours[j], neighbours[i]];
      }
      for (const neighbour of neighbours) {
        if (!visited.has(neighbour) && bfsPath.length < 5) {
          visited.add(neighbour);
          bfsPath.push(neighbour);
          queue.push(neighbour);
        }
      }
    }

    const nodeRevealOrder = [
      ...bfsPath,
      ...Array.from({ length: nodePositions.length }, (_, index) => index).filter((index) => !visited.has(index)),
    ];

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2(0, 0);

    let mouseX = 0;
    let mouseY = 0;
    let smoothMouseX = 0;
    let smoothMouseY = 0;
    let hoveredIndex = -1;
    let scrollSmooth = 0;
    let animationFrame = 0;
    let reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const mobileQuery = window.matchMedia('(max-width: 768px)');

    const onReduceMotionChange = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches;
    };
    const onMobileChange = (event: MediaQueryListEvent) => {
      isMobile = event.matches;
    };

    const onMouseMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      pointer.set(x * 2 - 1, -(y * 2 - 1));
      mouseX = (x - 0.5) * 2;
      mouseY = (y - 0.5) * 2;
    };

    const onResize = () => resize();

    window.addEventListener('pointermove', onMouseMove);
    window.addEventListener('resize', onResize);
    reduceMotionQuery.addEventListener('change', onReduceMotionChange);
    mobileQuery.addEventListener('change', onMobileChange);

    const clock = new THREE.Clock();
    const travelEnd = 0.18;
    const tempForward = new THREE.Vector3();
    const tempMid = new THREE.Vector3();
    const cameraPos = new THREE.Vector3();
    const cameraLookAt = new THREE.Vector3();

    const animate = () => {
      animationFrame = window.requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();
      const dt = Math.min(clock.getDelta(), 0.05);

      const scrollTarget = scrollYProgress.get();
      scrollSmooth = scrollSmooth + (scrollTarget - scrollSmooth) * 0.055;
      smoothMouseX = lerp(smoothMouseX, mouseX, 0.06);
      smoothMouseY = lerp(smoothMouseY, mouseY, 0.06);

      const pullT = clamp01((scrollSmooth - travelEnd) / (1 - travelEnd));
      const easedPull = smoothstep(pullT);

      if (!reducedMotion) {
        const rotationRate = lerp(0, 0.0018, easedPull);
        graphGroup.rotation.y += rotationRate;
      }

      const revealFront =
        scrollSmooth < travelEnd
          ? (scrollSmooth / travelEnd) * bfsPath.length
          : bfsPath.length + ((scrollSmooth - travelEnd) / (1 - travelEnd)) * (nodePositions.length - bfsPath.length);

      nodeRevealOrder.forEach((nodeIndex, orderIndex) => {
        const vis = clamp01(revealFront - orderIndex);
        const targetVis = vis > 0 ? easeOutBack(clamp01(vis * 3)) : 0;
        nodeVisible[nodeIndex] = clamp01(targetVis);

        const scale = Math.max(nodeVisible[nodeIndex], 0);
        nodeMeshes[nodeIndex].scale.setScalar(scale);

        const pulse = 0.85 + 0.15 * Math.sin(elapsed * 1.4 + nodeIndex * 0.7);
        const purpleMaterial = purpleGlows[nodeIndex].material as THREE.SpriteMaterial;
        purpleMaterial.opacity = scale * pulse * 0.65;
        purpleGlows[nodeIndex].scale.setScalar((1.2 + 0.15 * pulse) * scale);
      });

      raycaster.setFromCamera(pointer, camera);
      raycaster.params.Line.threshold = 0.35;
      const activeMeshes = nodeMeshes.filter((_, index) => nodeVisible[index] > 0.3);
      const intersections = raycaster.intersectObjects(activeMeshes, false);
      let newHovered = intersections.length > 0 ? nodeMeshes.indexOf(intersections[0].object as THREE.Mesh) : -1;
      if (newHovered < 0) {
        const visibleEdgeHits = edgeHitLines.filter((line) => line.visible);
        const edgeIntersections = raycaster.intersectObjects(visibleEdgeHits, false);
        if (edgeIntersections.length > 0) {
          const hitLine = edgeIntersections[0].object as THREE.Line;
          const { a, b } = hitLine.userData as { a: number; b: number };
          const hitPoint = edgeIntersections[0].point;
          const aDistance = nodePositions[a].distanceToSquared(hitPoint);
          const bDistance = nodePositions[b].distanceToSquared(hitPoint);
          newHovered = aDistance <= bDistance ? a : b;
        }
      }
      if (newHovered !== hoveredIndex) {
        if (hoveredIndex >= 0) hoverTarget[hoveredIndex] = 0;
        if (newHovered >= 0) hoverTarget[newHovered] = 1;
        hoveredIndex = newHovered;
      }

      for (let i = 0; i < nodePositions.length; i += 1) {
        hoverCurrent[i] = clamp01(hoverCurrent[i] + (hoverTarget[i] - hoverCurrent[i]) * dt * 3.5);

        const visible = nodeVisible[i];
        const whiteMaterial = whiteGlows[i].material as THREE.SpriteMaterial;
        whiteMaterial.opacity = hoverCurrent[i] * visible * 0.92;
        whiteGlows[i].scale.setScalar((2.2 + hoverCurrent[i] * 1.8) * Math.max(visible, 0));

        const nodeMaterial = nodeMeshes[i].material as THREE.MeshPhongMaterial;
        nodeMaterial.emissiveIntensity = 1.8 + hoverCurrent[i] * 2.5;
        nodeMaterial.color.setHex(hoverCurrent[i] > 0.3 ? nodeHoverColor : nodeBaseColor);
      }

      edgeObjects.forEach((edge) => {
        const visA = nodeVisible[edge.a];
        const visB = nodeVisible[edge.b];
        const vis = Math.min(visA, visB);
        const wobble = reducedMotion ? 0 : Math.sin(elapsed * edge.speed + edge.phase) * edge.wobbleAmp;
        tempMid.copy(edge.mid).addScaledVector(edge.perp, wobble * vis);

        const pA = nodePositions[edge.a];
        const pB = nodePositions[edge.b];
        for (let segment = 0; segment <= segmentCount; segment += 1) {
          const u = segment / segmentCount;
          const oneMinusU = 1 - u;
          const idx = segment * 3;
          edge.positions[idx] = pA.x * oneMinusU * oneMinusU + 2 * tempMid.x * u * oneMinusU + pB.x * u * u;
          edge.positions[idx + 1] = pA.y * oneMinusU * oneMinusU + 2 * tempMid.y * u * oneMinusU + pB.y * u * u;
          edge.positions[idx + 2] = pA.z * oneMinusU * oneMinusU + 2 * tempMid.z * u * oneMinusU + pB.z * u * u;
        }
        edge.updatePositions();

        const breathe = 0.6 + 0.4 * Math.sin(elapsed * edge.speed + edge.phase + 0.5);
        const baseOp = vis > 0.3 ? vis : 0;
        const targetCore = (0.5 + 0.2 * breathe) * baseOp;
        const targetHalo = (0.18 + 0.1 * breathe) * baseOp;

        edge.coreOpacity += (targetCore - edge.coreOpacity) * 0.06;
        edge.haloOpacity += (targetHalo - edge.haloOpacity) * 0.06;
        edge.setOpacity(edge.coreOpacity, edge.haloOpacity);
        edge.setVisible(edge.coreOpacity > 0.005 || edge.haloOpacity > 0.005);
      });

      if (scrollSmooth < travelEnd) {
        const pathT = scrollSmooth / travelEnd;
        const rawIndex = pathT * (bfsPath.length - 1);
        const segmentIndex = Math.min(Math.floor(rawIndex), bfsPath.length - 2);
        const segmentT = rawIndex - segmentIndex;

        const nodeA = nodePositions[bfsPath[segmentIndex]];
        const nodeB = nodePositions[bfsPath[segmentIndex + 1]];
        
        // Direction of the link
        tempForward.copy(nodeB).sub(nodeA).normalize();

        // CAMERA JOURNEY: Travelling backwards down the link while facing forward (towards nodeB)
        // We start "inside" the detail and pull back along the edge
        // As segmentT increases (scrolling down), we move from being near nodeA towards being near nodeB
        // but always offset backwards along the direction vector to maintain distance.
        
        // Offset the camera slightly to the side of the link for a more cinematic "travelling down" feel
        const sideOffset = edgeObjects[0].perp.clone().multiplyScalar(0.4);
        
        cameraPos.copy(nodeA)
          .addScaledVector(tempForward, segmentT * nodeA.distanceTo(nodeB)) // Progress along link
          .addScaledVector(tempForward, -2.5) // Stay offset backwards from the current progress point
          .add(sideOffset); // Side offset
          
        cameraPos.y += 0.2;
        cameraPos.x += smoothMouseX * 0.25;
        cameraPos.y -= smoothMouseY * 0.25;
        camera.position.copy(cameraPos);

        // Look at the node we are travelling towards (nodeB)
        cameraLookAt.copy(nodeB);
        cameraLookAt.x += smoothMouseX * 0.15;
        cameraLookAt.y -= smoothMouseY * 0.15;
        camera.lookAt(cameraLookAt);
        
        // Start narrow (zoomed in on detail) and widen slightly
        camera.fov = 34 + (pathT * 8); 
      } else {
        const targetZ = lerp(4, 26, easedPull);
        const targetY = lerp(0.25, 5.5, easedPull);

        cameraPos.set(
          smoothMouseX * lerp(0.4, 2.0, easedPull),
          targetY + smoothMouseY * lerp(-0.3, -1.0, easedPull),
          targetZ,
        );
        camera.position.copy(cameraPos);

        cameraLookAt.set(
          smoothMouseX * lerp(0.15, 0.6, easedPull),
          lerp(0, 1.8, easedPull),
          0,
        );
        camera.lookAt(cameraLookAt);
        camera.fov = 42 + easedPull * 26;
      }
      camera.updateProjectionMatrix();

      // Thresholds for staggered reveal after the graph is fully formed (zoomed out).
      const titleThreshold = 0.78;
      const bodyThreshold = 0.88;
      const welcomeOutThreshold = 0.034; // Gone once the first node fully reveals

      // Welcome message visibility
      welcomeEl.classList.toggle(styles.visible, scrollSmooth < welcomeOutThreshold);

      if (isMobile) {
        // Mobile sequence: graph -> title slide -> body slide
        const titleOutThreshold = 0.86;
        const titleVisible = scrollSmooth > titleThreshold && scrollSmooth < titleOutThreshold;
        const bodyVisible = scrollSmooth > bodyThreshold;

        titleEl.classList.toggle(styles.visible, titleVisible);
        bodyEl.classList.toggle(styles.visible, bodyVisible);

        // Adjust graph fade window to coincide with text reveal
        const fadeWindow = clamp01((scrollSmooth - 0.5) / 0.45);
        const graphOpacity = lerp(1, 0.18, smoothstep(fadeWindow));
        rootEl.style.setProperty('--graph-opacity', String(graphOpacity));
      } else {
        // Desktop: title and body reveal and stay anchored
        const titleVisible = scrollSmooth > titleThreshold;
        const bodyVisible = scrollSmooth > bodyThreshold;

        titleEl.classList.toggle(styles.visible, titleVisible);
        bodyEl.classList.toggle(styles.visible, bodyVisible);
        rootEl.style.setProperty('--graph-opacity', '1');
      }

      const visibleCount = Math.min(Math.round(Math.max(revealFront, 1)), nodePositions.length);
      nodeCountEl.textContent = visibleCount === 1 ? '1 node' : `${visibleCount} nodes`;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('pointermove', onMouseMove);
      window.removeEventListener('resize', onResize);
      reduceMotionQuery.removeEventListener('change', onReduceMotionChange);
      mobileQuery.removeEventListener('change', onMobileChange);

      edgeObjects.forEach((edge) => edge.dispose());
      edgeHitLines.length = 0;
      nodeMeshes.forEach((mesh) => {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((material) => material.dispose());
        } else {
          mesh.material.dispose();
        }
      });
      purpleGlows.forEach((glow) => {
        (glow.material as THREE.SpriteMaterial).dispose();
      });
      whiteGlows.forEach((glow) => {
        (glow.material as THREE.SpriteMaterial).dispose();
      });

      sphereGeometry.dispose();
      starGeometry.dispose();
      starMaterial.dispose();
      starTexture.dispose();
      purpleGlowTexture.dispose();
      whiteGlowTexture.dispose();
      renderer.dispose();
      scene.clear();
    };
  }, [scrollYProgress]);

  return (
    <div className={styles.heroRoot} ref={rootRef}>
      <canvas ref={canvasRef} className={styles.canvas} />
      <div className={styles.heroScrim} />

      <div className={styles.hud}>
        <div className={styles.nodeCount} ref={nodeCountRef}>1 node</div>
      </div>

      <button onClick={onSignIn} className={styles.signInButton} aria-label={landingHeroCopy.returningSignInLabel}>
        {landingHeroCopy.returningSignInLabel}
      </button>

      <div className={styles.welcomeTitle} ref={welcomeRef}>
        Welcome to Osra
      </div>

      <div id="hero-title" className={styles.heroTitle} ref={titleRef}>
        {landingHeroCopy.title}
      </div>
      <div id="hero-body" className={styles.heroBody} ref={bodyRef}>
        <span className={styles.shine}>Osra</span> {landingHeroCopy.summary}
        {' '}
        Built for privacy and performance, {landingHeroCopy.detailLead}{' '}
        <span className={styles.shine}>{landingHeroCopy.detailHighlight}</span> {landingHeroCopy.detailTail}
      </div>
    </div>
  );
}
