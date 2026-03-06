import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { type MotionValue } from 'motion/react';
import Button from '@mui/material/Button';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import styles from './MeetOsraHero.module.css';

interface MeetOsraHeroProps {
  onSignIn: () => void;
  scrollYProgress: MotionValue<number>;
}

// ── Seeded XOR-shift RNG ──────────────────────────────────────────────────────
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    return (s >>> 0) / 0xffffffff;
  };
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function clamp01(v: number) { return Math.min(Math.max(v, 0), 1); }
function smoothstep(t: number) { return t * t * (3 - 2 * t); }
function easeOutBack(t: number) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function makeGlowTex(inner: string, outer: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, inner);
  g.addColorStop(0.35, outer);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function makeStarTex(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.92)');
  g.addColorStop(0.65, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

export function MeetOsraHero({ onSignIn, scrollYProgress }: MeetOsraHeroProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const welcomeRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const nodeCountRef = useRef<HTMLSpanElement>(null);
  const scrollHintRef = useRef<HTMLSpanElement>(null);
  const [webglFailed, setWebglFailed] = useState(false);

  useEffect(() => {
    const rootEl = rootRef.current;
    const canvas = canvasRef.current;
    const welcomeEl = welcomeRef.current;
    const titleEl = titleRef.current;
    const bodyEl = bodyRef.current;
    const nodeCountEl = nodeCountRef.current;
    const scrollHintEl = scrollHintRef.current;

    if (!rootEl || !canvas || !welcomeEl || !titleEl || !bodyEl || !nodeCountEl || !scrollHintEl) return;

    const rng = makeRng(0xdeadbeef);
    const isMobileInit = window.matchMedia('(max-width: 768px)').matches;

    try {
    // ── Renderer ─────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !isMobileInit,
      alpha: false,
      powerPreference: isMobileInit ? 'low-power' : 'default',
      failIfMajorPerformanceCaveat: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x07030f, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x07030f, 0.012);

    const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 300);
    camera.position.set(0, 0, 4);

    const lineMats: LineMaterial[] = [];
    // Detect desktop once at setup for node count (80 desktop, 50 mobile)
    const isDesktopInit = !window.matchMedia('(max-width: 768px)').matches;

    let vpW = 1, vpH = 1;

    const resize = () => {
      const rect = rootEl.getBoundingClientRect();
      vpW = Math.max(1, rect.width);
      vpH = Math.max(1, rect.height);
      renderer.setSize(vpW, vpH, false);
      camera.aspect = vpW / vpH;
      camera.updateProjectionMatrix();
      lineMats.forEach(m => m.resolution.set(vpW, vpH));
    };
    resize();
    requestAnimationFrame(() => resize());

    // ── Lights ───────────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0x1a0033, 2.2));
    const pl1 = new THREE.PointLight(0x9333ea, 5, 60); pl1.position.set(5, 6, 8); scene.add(pl1);
    const pl2 = new THREE.PointLight(0x7c3aed, 3, 50); pl2.position.set(-8, -3, 5); scene.add(pl2);
    const pl3 = new THREE.PointLight(0xd8b4fe, 2, 45); pl3.position.set(0, -8, -6); scene.add(pl3);

    // ── Stars ────────────────────────────────────────────────────────────────
    {
      const n = 1100;
      const p = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        p[i * 3]     = (rng() - 0.5) * 200;
        p[i * 3 + 1] = (rng() - 0.5) * 200;
        p[i * 3 + 2] = (rng() - 0.5) * 200;
      }
      const sg = new THREE.BufferGeometry();
      sg.setAttribute('position', new THREE.BufferAttribute(p, 3));
      const starTex = makeStarTex();
      scene.add(new THREE.Points(sg, new THREE.PointsMaterial({
        color: 0xc4b5fd, size: 0.09, map: starTex,
        transparent: true, opacity: 0.3, alphaTest: 0.5,
        depthWrite: false, blending: THREE.AdditiveBlending,
      })));
    }

    // ── Nodes: 80 on desktop, 50 on mobile ───────────────────────────────────
    const N = isDesktopInit ? 80 : 50;
    const nodePos: THREE.Vector3[] = [];
    while (nodePos.length < N) {
      const rx = 4.0 + rng() * 13.0;
      const ry = 3.5 + rng() * 8.0;
      const rz = 2.0 + rng() * 6.0;
      const theta = rng() * Math.PI * 2;
      const phi = Math.acos(2 * rng() - 1);
      const p = new THREE.Vector3(
        rx * Math.sin(phi) * Math.cos(theta),
        ry * Math.sin(phi) * Math.sin(theta) * 0.55,
        rz * Math.cos(phi),
      );
      if (!nodePos.some(q => q.distanceTo(p) < 1.8)) nodePos.push(p);
    }

    // ── Edges: k=2 nearest ───────────────────────────────────────────────────
    const edgeDefs: [number, number][] = [];
    const edgeSet = new Set<string>();
    nodePos.forEach((pos, i) => {
      nodePos
        .map((p, j) => ({ j, d: pos.distanceTo(p) }))
        .filter(x => x.j !== i)
        .sort((a, b) => a.d - b.d)
        .slice(0, 2)
        .forEach(({ j }) => {
          const k = `${Math.min(i, j)}_${Math.max(i, j)}`;
          if (!edgeSet.has(k)) { edgeSet.add(k); edgeDefs.push([i, j]); }
        });
    });

    // ── Adjacency ────────────────────────────────────────────────────────────
    const adj: number[][] = Array.from({ length: N }, () => []);
    edgeDefs.forEach(([a, b]) => { adj[a].push(b); adj[b].push(a); });

    // ── Glow textures ────────────────────────────────────────────────────────
    const purpleGlowTex = makeGlowTex('rgba(196,181,253,0.95)', 'rgba(124,58,237,0.5)');
    const whiteGlowTex  = makeGlowTex('rgba(255,255,255,1.0)', 'rgba(220,200,255,0.6)');

    // ── Graph group — unified Y-axis skewer rotation ──────────────────────────
    const graphGroup = new THREE.Group();
    graphGroup.position.y = 0.45;
    scene.add(graphGroup);

    // ── Node objects ─────────────────────────────────────────────────────────
    const sphereGeo   = new THREE.SphereGeometry(0.18, 24, 24);
    const nodeMeshes: THREE.Mesh[] = [];
    const purpleGlows: THREE.Sprite[] = [];
    const whiteGlows: THREE.Sprite[] = [];
    const nodeVisible  = new Array(N).fill(0);
    const hoverTarget  = new Array(N).fill(0);
    const hoverCurrent = new Array(N).fill(0);

    nodePos.forEach((pos) => {
      const mesh = new THREE.Mesh(sphereGeo, new THREE.MeshPhongMaterial({
        color: 0x6d28d9, emissive: 0x3b0764, emissiveIntensity: 0.7,
        specular: 0xe9d5ff, shininess: 140,
        transparent: false, opacity: 1.0,
      }));
      mesh.position.copy(pos);
      mesh.scale.setScalar(0);
      mesh.renderOrder = 6;

      const pg = new THREE.Sprite(new THREE.SpriteMaterial({
        map: purpleGlowTex, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true,
      }));
      pg.position.copy(pos); pg.scale.setScalar(1.3); pg.renderOrder = 4;

      const wg = new THREE.Sprite(new THREE.SpriteMaterial({
        map: whiteGlowTex, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true,
      }));
      wg.position.copy(pos); wg.scale.setScalar(2.2); wg.renderOrder = 5;

      graphGroup.add(pg, wg, mesh);
      purpleGlows.push(pg);
      whiteGlows.push(wg);
      nodeMeshes.push(mesh);
    });

    // ── Edge objects — Line2 (GPU thickness) ─────────────────────────────────
    const SEGS = 18;

    interface EdgeObj {
      a: number; b: number;
      mid: THREE.Vector3; perp: THREE.Vector3;
      phase: number; speed: number; wobbleAmp: number;
      positions: Float32Array;
      coreGeo: LineGeometry; haloGeo: LineGeometry;
      coreMat: LineMaterial; haloMat: LineMaterial;
    }

    const edgeObjs: EdgeObj[] = [];

    edgeDefs.forEach(([a, b]) => {
      const posA = nodePos[a], posB = nodePos[b];
      const mid = posA.clone().lerp(posB, 0.5);
      const perp = new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize();
      const phase     = rng() * Math.PI * 2;
      const speed     = 0.25 + rng() * 0.4;
      const wobbleAmp = 0.08 + rng() * 0.12;
      const positions = new Float32Array((SEGS + 1) * 3);

      const coreGeo = new LineGeometry();
      const haloGeo = new LineGeometry();
      coreGeo.setPositions(positions);
      haloGeo.setPositions(positions);

      const coreMat = new LineMaterial({
        color: 0xffffff, transparent: true, opacity: 0,
        linewidth: 2.5, blending: THREE.AdditiveBlending,
        dashed: false, depthTest: false, depthWrite: false,
      });
      const haloMat = new LineMaterial({
        color: 0xd8b4fe, transparent: true, opacity: 0,
        linewidth: 4.0, blending: THREE.AdditiveBlending,
        dashed: false, depthTest: false, depthWrite: false,
      });

      coreMat.resolution.set(vpW, vpH);
      haloMat.resolution.set(vpW, vpH);
      lineMats.push(coreMat, haloMat);

      const coreLine = new Line2(coreGeo, coreMat);
      const haloLine = new Line2(haloGeo, haloMat);
      coreLine.frustumCulled = false;
      haloLine.frustumCulled = false;
      coreLine.renderOrder = 2;
      haloLine.renderOrder = 1;
      graphGroup.add(haloLine, coreLine);

      edgeObjs.push({ a, b, mid, perp, phase, speed, wobbleAmp, positions, coreGeo, haloGeo, coreMat, haloMat });
    });

    // ── Camera BFS path (5 waypoints) ────────────────────────────────────────
    const camPath = [0];
    const camVisited = new Set([0]);
    const bfsQ = [0];
    while (bfsQ.length && camPath.length < 5) {
      const curr = bfsQ.shift()!;
      const shuffled = [...adj[curr]].sort(() => rng() - 0.5);
      for (const nxt of shuffled) {
        if (!camVisited.has(nxt) && camPath.length < 5) {
          camVisited.add(nxt); camPath.push(nxt); bfsQ.push(nxt);
        }
      }
    }
    const nodeRevealOrder = [
      ...camPath,
      ...Array.from({ length: N }, (_, i) => i).filter(i => !camVisited.has(i)),
    ];

    // ── Input ────────────────────────────────────────────────────────────────
    let mouseX = 0, mouseY = 0, smMouseX = 0, smMouseY = 0;
    const mouse2D = new THREE.Vector2();
    let reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let isMobile = window.matchMedia('(max-width: 768px)').matches;

    const onMouseMove = (e: MouseEvent) => {
      mouseX = (e.clientX / window.innerWidth  - 0.5) * 2;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
      mouse2D.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    };
    const onResize = () => resize();
    const onReduceMotion = (e: MediaQueryListEvent) => { reducedMotion = e.matches; };
    const onMobileChange = (e: MediaQueryListEvent) => { isMobile = e.matches; };

    const reduceQ = window.matchMedia('(prefers-reduced-motion: reduce)');
    const mobileQ = window.matchMedia('(max-width: 768px)');

    window.addEventListener('pointermove', onMouseMove);
    window.addEventListener('resize', onResize);
    reduceQ.addEventListener('change', onReduceMotion);
    mobileQ.addEventListener('change', onMobileChange);

    // ── Raycaster ────────────────────────────────────────────────────────────
    const raycaster = new THREE.Raycaster();
    let hoveredIdx = -1;

    // ── Scroll state ─────────────────────────────────────────────────────────
    let scrollSmooth = 0;
    const TRAVEL_END = 0.18;

    // ── Working vectors ───────────────────────────────────────────────────────
    const _vM  = new THREE.Vector3();
    const _fwd = new THREE.Vector3();
    const camPos    = new THREE.Vector3();
    const camLookAt = new THREE.Vector3();

    const clock = new THREE.Clock();
    let raf = 0;

    // ── Animate ───────────────────────────────────────────────────────────────
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      const dt = Math.min(clock.getDelta(), 0.05);

      const scrollTarget = scrollYProgress.get();
      scrollSmooth = lerp(scrollSmooth, scrollTarget, 0.055);
      smMouseX = lerp(smMouseX, mouseX, 0.06);
      smMouseY = lerp(smMouseY, mouseY, 0.06);

      const pullT     = clamp01((scrollSmooth - TRAVEL_END) / (1 - TRAVEL_END));
      const easedPull = smoothstep(pullT);

      // ── Skewer rotation ──
      if (!reducedMotion) {
        graphGroup.rotation.y += lerp(0, 0.0018, easedPull);
      }

      // ── Node reveal ──
      const revealFront = scrollSmooth < TRAVEL_END
        ? (scrollSmooth / TRAVEL_END) * camPath.length
        : camPath.length + ((scrollSmooth - TRAVEL_END) / (1 - TRAVEL_END)) * (N - camPath.length);

      nodeRevealOrder.forEach((ni, ri) => {
        const vis = clamp01(revealFront - ri);
        nodeVisible[ni] = lerp(nodeVisible[ni], vis > 0 ? easeOutBack(clamp01(vis * 3)) : 0, 0.07);
        const s = Math.max(nodeVisible[ni], 0);
        nodeMeshes[ni].scale.setScalar(s);
        const pulse = 0.85 + 0.15 * Math.sin(t * 1.4 + ni * 0.7);
        const pgMat = purpleGlows[ni].material as THREE.SpriteMaterial;
        pgMat.opacity = s * pulse * 0.65;
        purpleGlows[ni].scale.setScalar((1.2 + 0.15 * pulse) * s);
      });

      // ── Hover ──
      raycaster.setFromCamera(mouse2D, camera);
      const activeMeshes = nodeMeshes.filter((_, i) => nodeVisible[i] > 0.3);
      const hits = raycaster.intersectObjects(activeMeshes, false);
      const newHovered = hits.length > 0 ? nodeMeshes.indexOf(hits[0].object as THREE.Mesh) : -1;
      if (newHovered !== hoveredIdx) {
        if (hoveredIdx >= 0) hoverTarget[hoveredIdx] = 0;
        if (newHovered >= 0) hoverTarget[newHovered] = 1;
        hoveredIdx = newHovered;
      }
      for (let i = 0; i < N; i++) {
        hoverCurrent[i] = clamp01(hoverCurrent[i] + (hoverTarget[i] - hoverCurrent[i]) * dt * 3.5);
        const wgMat = whiteGlows[i].material as THREE.SpriteMaterial;
        const s = nodeVisible[i];
        wgMat.opacity = hoverCurrent[i] * s * 0.92;
        whiteGlows[i].scale.setScalar((2.2 + hoverCurrent[i] * 1.8) * Math.max(s, 0));
        const nm = nodeMeshes[i].material as THREE.MeshPhongMaterial;
        nm.emissiveIntensity = 0.7 + hoverCurrent[i] * 2.5;
        nm.color.setHex(hoverCurrent[i] > 0.3 ? 0x9f7aea : 0x6d28d9);
      }

      // ── Edges ──
      edgeObjs.forEach(ed => {
        const { a, b, mid, perp, phase, speed, wobbleAmp, positions, coreGeo, haloGeo, coreMat, haloMat } = ed;
        const vis = Math.min(nodeVisible[a], nodeVisible[b]);

        const wobble = reducedMotion ? 0 : Math.sin(t * speed + phase) * wobbleAmp;
        _vM.copy(mid).addScaledVector(perp, wobble * vis);

        const pA = nodePos[a], pB = nodePos[b];
        for (let j = 0; j <= SEGS; j++) {
          const u = j / SEGS, ou = 1 - u;
          const idx = j * 3;
          positions[idx]     = pA.x * ou * ou + 2 * _vM.x * u * ou + pB.x * u * u;
          positions[idx + 1] = pA.y * ou * ou + 2 * _vM.y * u * ou + pB.y * u * u;
          positions[idx + 2] = pA.z * ou * ou + 2 * _vM.z * u * ou + pB.z * u * u;
        }
        coreGeo.setPositions(positions);
        haloGeo.setPositions(positions);

        const breathe = 0.6 + 0.4 * Math.sin(t * speed + phase + 0.5);
        const baseOp  = vis > 0.3 ? vis : 0;
        coreMat.opacity = lerp(coreMat.opacity, (0.5 + 0.2 * breathe) * baseOp, 0.06);
        haloMat.opacity = lerp(haloMat.opacity, (0.18 + 0.1 * breathe) * baseOp, 0.06);
      });

      // ── Camera ──
      if (scrollSmooth < TRAVEL_END) {
        // Travel: fly through the BFS nodes, facing forward down each link
        const pathT  = scrollSmooth / TRAVEL_END;
        const rawIdx = pathT * (camPath.length - 1);
        const segIdx = Math.min(Math.floor(rawIdx), camPath.length - 2);
        const segT   = rawIdx - segIdx;

        const nodeA = nodePos[camPath[segIdx]];
        const nodeB = nodePos[camPath[segIdx + 1]];
        _fwd.copy(nodeB).sub(nodeA).normalize();

        // Sit behind nodeA, face toward nodeB
        camPos.copy(nodeA).addScaledVector(_fwd, -1.2 + segT * 0.8).addScaledVector(_fwd, -0.5);
        camPos.y += 0.25;
        camPos.x += smMouseX * 0.35;
        camPos.y -= smMouseY * 0.35;

        // Lerp camera for smooth cinematic movement
        camera.position.lerp(camPos, 0.045);

        camLookAt.copy(nodeB);
        camLookAt.x += smMouseX * 0.18;
        camLookAt.y -= smMouseY * 0.18;
        camera.lookAt(camLookAt);
        camera.fov = lerp(camera.fov, 42, 0.04);

      } else {
        // Pullback: zoom out so graph spans the full viewport without clipping.
        // GRAPH_SWEEP accounts for Y-axis rotation: node at (X=17, Z=8) sweeps
        // a radius of √(17²+8²) ≈ 19. Add breathing room → 22.
        const GRAPH_SWEEP = 22;
        const finalFovDeg = 72;
        const finalFovRad = finalFovDeg * Math.PI / 180;
        const hFovHalf = Math.atan(Math.tan(finalFovRad / 2) * camera.aspect);
        // Pull back far enough to show the full rotational sweep, min 18
        const finalZ = Math.max(18, GRAPH_SWEEP / Math.tan(hFovHalf));

        // Lower camera elevation so the graph doesn't clip at the bottom
        const finalY = 3.5;
        const targetZ = lerp(4, finalZ, easedPull);
        const targetY = lerp(0.25, finalY, easedPull);

        camPos.set(
          smMouseX * lerp(0.4, 2.0, easedPull),
          targetY + smMouseY * lerp(-0.3, -1.0, easedPull),
          targetZ,
        );
        camera.position.lerp(camPos, 0.035);

        camLookAt.set(
          smMouseX * lerp(0.15, 0.6, easedPull),
          lerp(0, 0.5, easedPull),
          0,
        );
        camera.lookAt(camLookAt);
        camera.fov = lerp(camera.fov, finalFovDeg, 0.03);
      }
      camera.updateProjectionMatrix();

      // ── Text reveals ──
      // Welcome title: visible on load, gone once first node appears
      welcomeEl.classList.toggle(styles.visible, scrollSmooth < 0.034);
      scrollHintEl.style.opacity = scrollSmooth > 0.04 ? '0' : '0.22';

      // Meet Osra title + body: staggered, after graph fully formed
      if (isMobile) {
        const titleIn  = TRAVEL_END + (1 - TRAVEL_END) * 0.50;
        const titleOut = TRAVEL_END + (1 - TRAVEL_END) * 0.68;
        const bodyIn   = TRAVEL_END + (1 - TRAVEL_END) * 0.76;
        titleEl.classList.toggle(styles.visible, scrollSmooth > titleIn && scrollSmooth < titleOut);
        bodyEl.classList.toggle(styles.visible, scrollSmooth > bodyIn);
      } else {
        titleEl.classList.toggle(styles.visible, scrollSmooth > TRAVEL_END + 0.82 * 0.76);
        bodyEl.classList.toggle(styles.visible,  scrollSmooth > TRAVEL_END + 0.82 * 0.88);
      }

      // ── HUD ──
      const shown = Math.min(Math.round(Math.max(revealFront, 1)), N);
      nodeCountEl.textContent = shown === 1 ? '1 node' : `${shown} nodes`;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMouseMove);
      window.removeEventListener('resize', onResize);
      reduceQ.removeEventListener('change', onReduceMotion);
      mobileQ.removeEventListener('change', onMobileChange);
      edgeObjs.forEach(e => {
        e.coreGeo.dispose(); e.haloGeo.dispose();
        e.coreMat.dispose(); e.haloMat.dispose();
      });
      nodeMeshes.forEach(m => {
        (m.material as THREE.MeshPhongMaterial).dispose();
      });
      purpleGlows.forEach(g => (g.material as THREE.SpriteMaterial).dispose());
      whiteGlows.forEach(g => (g.material as THREE.SpriteMaterial).dispose());
      sphereGeo.dispose();
      purpleGlowTex.dispose();
      whiteGlowTex.dispose();
      renderer.dispose();
      scene.clear();
    };
    } catch (err) {
      console.error('[MeetOsraHero] WebGL init failed:', err);
      setWebglFailed(true);
    }
  }, [scrollYProgress]);

  if (webglFailed) {
    return (
      <div className={styles.heroRoot} style={{ background: 'radial-gradient(ellipse at 50% 50%, #1a0a2e 0%, #07030f 70%)' }}>
        <div className={styles.hud}>
          <span className={styles.nodeCount}>—</span>
          <span className={styles.scrollHint} style={{ opacity: 0.22 }}>scroll to explore</span>
        </div>
        <Button
          onClick={onSignIn}
          sx={{
            position: 'absolute',
            top: 14,
            right: 14,
            zIndex: 24,
            border: '1px solid rgba(255, 255, 255, 0.33)',
            borderRadius: 999,
            background: 'rgba(12, 10, 20, 0.44)',
            color: '#ede9fe',
            fontFamily: '"Lora", Georgia, serif',
            fontSize: 'clamp(0.68rem, 1.7vw, 0.8rem)',
            letterSpacing: '0.03em',
            padding: '6px 12px',
            backdropFilter: 'blur(4px)',
            '&:hover': {
              background: 'rgba(25, 18, 44, 0.68)',
              borderColor: 'rgba(255, 255, 255, 0.54)',
            },
          }}
        >
          Sign in
        </Button>
        <div className={`${styles.welcomeTitle} ${styles.visible}`}>Welcome to Osra</div>
        <div className={styles.heroTitle}>Meet Osra</div>
        <div className={styles.heroBody}>
          <span className={styles.shine}>Osra</span> is a beautiful, interactive, and fully immersive family tree experience.
          Built for privacy and performance, Osra gives every family their own universe
          to explore, in <span className={styles.shine}>stunning</span> 3D space.
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className={styles.heroRoot}>
      <canvas ref={canvasRef} className={styles.canvas} />

      <div className={styles.hud}>
        <span ref={nodeCountRef} className={styles.nodeCount}>1 node</span>
        <span ref={scrollHintRef} className={styles.scrollHint} style={{ opacity: 0.22 }}>scroll to travel</span>
      </div>

      <Button
        onClick={onSignIn}
        sx={{
          position: 'absolute',
          top: 14,
          right: 14,
          zIndex: 24,
          border: '1px solid rgba(255, 255, 255, 0.33)',
          borderRadius: 999,
          background: 'rgba(12, 10, 20, 0.44)',
          color: '#ede9fe',
          fontFamily: '"Lora", Georgia, serif',
          fontSize: 'clamp(0.68rem, 1.7vw, 0.8rem)',
          letterSpacing: '0.03em',
          padding: '6px 12px',
          backdropFilter: 'blur(4px)',
          '&:hover': {
            background: 'rgba(25, 18, 44, 0.68)',
            borderColor: 'rgba(255, 255, 255, 0.54)',
          },
        }}
      >
        Sign in
      </Button>

      {/* Welcome — visible on load, fades as scroll begins */}
      <div ref={welcomeRef} className={`${styles.welcomeTitle} ${styles.visible}`}>
        Welcome to Osra
      </div>

      {/* Hero text — revealed late in scroll */}
      <div ref={titleRef} className={styles.heroTitle}>
        Meet Osra
      </div>
      <div ref={bodyRef} className={styles.heroBody}>
        <span className={styles.shine}>Osra</span> is a beautiful, interactive, and fully immersive family tree experience.
        Built for privacy and performance, Osra gives every family their own universe
        to explore, in <span className={styles.shine}>stunning</span> 3D space.
      </div>
    </div>
  );
}
