# Design Doc: Camera Stability and Cinematic Intro Zoom

**Date:** 2026-03-10
**Author:** Cursor Agent
**Status:** Approved

## Context
The Osra 3D Family Tree currently suffers from two major camera-related regressions:
1.  **"Black Screen" Crash**: When clicking distant nodes, the camera position can become `NaN` (Not a Number), causing the entire 3D scene to disappear. This state is persistent and cannot be recovered via "Reset View" because the reset animation uses the crashed position as a starting point.
2.  **Missing Intro Zoom**: The cinematic "fly-in" from space ($Z=30,000$) to the tree ($Z=650$) was lost in a recent update.

## Goals
- Ensure "Reset View" always recovers from a crashed (`NaN`) state.
- Restore the cinematic intro zoom sequence on load.
- Prevent "Camera Panic" by adding safety bounds to camera movement.
- Maintain the "well-spread" initial tree layout achieved in previous steps.

## Approach: The "Hard Reset" & Safe Intro

### 1. Robust Reset Logic
The `resetView` function will be updated to detect a crashed camera state:
- **Condition**: `isNaN(camera.position.x) || isNaN(camera.position.y) || isNaN(camera.position.z)`
- **Behavior (Crashed)**: Immediate teleportation to `{ x: 0, y: 0, z: 650 }`. This bypasses any animation that would propagate `NaN`.
- **Behavior (Healthy)**: Smooth `lerp` animation to `{ x: 0, y: 0, z: 650 }` over 1500ms.

### 2. Cinematic Intro Zoom Sequence
The intro sequence will be handled declaratively to avoid conflicts with the physics engine:
1.  **Initial Position**: On graph load, use `fgRef.current.cameraPosition({ x: 0, y: 0, z: 30000 })` with duration 0.
2.  **Zoom-In**: Once the loading screen fades, trigger `fgRef.current.cameraPosition({ x: 0, y: 0, z: 650 }, { x: 0, y: 0, z: 0 }, 4500)`.

### 3. Safety Bounds & Error Handling
- **Node Selection**: In `handleNodeClick`, add distance clamping to prevent the camera from flying beyond a safe distance (e.g., $150,000$ units).
- **NaN Prevention**: Explicitly check for `NaN` in all direction vector calculations.

## Implementation Notes
- Use `fgRef.current.cameraPosition` as the primary method for moving the camera, as it handles the `OrbitControls` update internally.
- Re-enable `frustumCulled = true` for stars but keep `fog: false` for background elements to maintain visibility at any distance.
- Remove `logarithmicDepthBuffer` if it causes unexpected behavior, as it was a speculative fix.

## Success Criteria
- [ ] Tree loads with the cinematic fly-in zoom.
- [ ] Clicking distant nodes never results in a black screen.
- [ ] If a black screen is somehow triggered, clicking "Reset View" immediately restores the scene.
- [ ] Tree remains well-spread on load.
