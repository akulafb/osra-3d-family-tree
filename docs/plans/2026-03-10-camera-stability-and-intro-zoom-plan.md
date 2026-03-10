# Camera Stability and Intro Zoom Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the "black screen" crash and restore the cinematic intro zoom in the 3D Family Tree.

**Architecture:** Use `fgRef.current.cameraPosition` for all camera movements to ensure `OrbitControls` sync. Add a "Hard Reset" to `resetView` that teleports the camera if its state is `NaN`. Restore the initial camera setup and zoom-in sequence in `useEffect`.

**Tech Stack:** React 18, Three.js, react-force-graph-3d

---

### Task 1: Revert Speculative "Black Screen" Fixes

Remove the `logarithmicDepthBuffer` and `frustumCulled` changes that didn't solve the core issue.

**Files:**

- Modify: `src/components/FamilyTree3D.tsx`
- Modify: `src/utils/starfield.ts`

**Step 1: Revert `rendererConfig` in `FamilyTree3D.tsx`**
Remove `rendererConfig={{ logarithmicDepthBuffer: true, antialias: true, alpha: true }}` from `<ForceGraph3DAny />`.

**Step 2: Revert `frustumCulled` and `fog: false` in `starfield.ts`**
Remove `cloud.frustumCulled = false` and `stars.frustumCulled = false`.
Remove `fog: false` from `MeshBasicMaterial` and `PointsMaterial`.

**Step 3: Commit**

```bash
git add src/components/FamilyTree3D.tsx src/utils/starfield.ts
git commit -m "revert: remove speculative fixes for black screen"
```

---

### Task 2: Implement "Hard Reset" in `resetView`

Ensure the camera can always recover from a `NaN` state.

**Files:**

- Modify: `src/components/FamilyTree3D.tsx:358-408`

**Step 1: Add NaN detection to `resetView`**

```typescript
  const resetView = useCallback(() => {
    if (!fgRef.current || !initialCameraPos || !graphData) return;
    
    const camera = fgRef.current.camera();
    const controls = fgRef.current.controls();
    if (!camera || !controls) return;

    // Detect Camera Panic (NaN state)
    const isCrashed = isNaN(camera.position.x) || isNaN(camera.position.y) || isNaN(camera.position.z);

    if (isCrashed) {
      console.warn('[FamilyTree3D] Camera crashed (NaN). Performing hard teleport reset.');
      // Immediate teleport reset (no animation)
      camera.position.set(initialCameraPos.x, initialCameraPos.y, initialCameraPos.z);
      controls.target.set(0, 0, 0);
      camera.lookAt(0, 0, 0);
      controls.update();
      fgRef.current.cameraPosition(
        { x: initialCameraPos.x, y: initialCameraPos.y, z: initialCameraPos.z },
        { x: 0, y: 0, z: 0 },
        0
      );
      return;
    }
    // ... existing animation code ...
```

**Step 2: Commit**

```bash
git add src/components/FamilyTree3D.tsx
git commit -m "fix: add hard reset to recovery from camera crash (NaN)"
```

---

### Task 3: Restore Cinematic Intro Zoom

Fix the intro zoom by properly setting the initial camera position and then triggering the animation.

**Files:**

- Modify: `src/components/FamilyTree3D.tsx:962-985`

**Step 1: Fix Initial Camera Setup**

```typescript
  useEffect(() => {
    if (fgRef.current && !initialCameraPos && graphData?.nodes?.length) {
      setInitialCameraPos({ x: 0, y: 0, z: 650 });
      // Set initial "Space" position
      fgRef.current.cameraPosition({ x: 0, y: 0, z: 30000 }, { x: 0, y: 0, z: 0 }, 0);
    }
  }, [initialCameraPos, graphData]);
```

**Step 2: Fix Zoom Sequence**

```typescript
  useEffect(() => {
    if (!isSimulationLoading && fgRef.current && !hasIntroPlayed.current && graphData?.nodes?.length) {
      hasIntroPlayed.current = true;

      setTimeout(() => {
        // Fly-in zoom
        fgRef.current.cameraPosition(
          { x: 0, y: 0, z: 650 },
          { x: 0, y: 0, z: 0 },
          4500
        );
      }, 500);
    }
  }, [isSimulationLoading, graphData]);
```

**Step 3: Commit**

```bash
git add src/components/FamilyTree3D.tsx
git commit -m "feat: restore cinematic intro zoom sequence"
```

---

### Task 4: Camera Selection Bounds

Prevent the camera from flying too far away and triggering a crash.

**Files:**

- Modify: `src/components/FamilyTree3D.tsx:325-355`

**Step 1: Add Distance Clamping in `handleNodeClick`**

```typescript
    const targetPos = {
      x: x + direction.x * distance,
      y: y + direction.y * distance,
      z: z + direction.z * distance
    };

    // Clamp camera position to prevent flying into infinity
    const MAX_DIST = 150000;
    const currentDist = Math.sqrt(targetPos.x**2 + targetPos.y**2 + targetPos.z**2);
    if (currentDist > MAX_DIST) {
      const scale = MAX_DIST / currentDist;
      targetPos.x *= scale;
      targetPos.y *= scale;
      targetPos.z *= scale;
    }
```

**Step 2: Commit**

```bash
git add src/components/FamilyTree3D.tsx
git commit -m "fix: clamp camera movement to prevent out-of-bounds crash"
```
