# Design Doc: Navigation Controls Improvement

## Overview
Augment the existing 3D navigation (WASD/Mouse Steering) with keyboard-based rotation and rebind the steering toggle to `R`.

## Requirements
- `R`: Toggle mouse steering (previously `E`).
- `Q`: Rotate camera anticlockwise (yaw left).
- `E`: Rotate camera clockwise (yaw right).
- Rotation speed must match the current `turnSpeed`.

## Architecture & Implementation

### 1. Key Binding Changes
In `src/components/FamilyTree3D.tsx`, the `onDown` handler will be updated:
- Remove `e` toggle.
- Add `r` toggle for `setIsSteeringActive`.

### 2. Keyboard Rotation Logic
In the `update` loop (Navigation Flight Loop):
- Check for `q` and `e` keys in `keysPressed.current`.
- Calculate a cumulative yaw value using `turnSpeed`.
- Apply this yaw to the camera's look direction (target) relative to the camera position.

### 3. UI Updates
- The `NAV CONTROLS` help overlay will be updated to reflect the new key bindings.

## Testing Plan
- Press `R` to toggle steering and verify mouse look behavior.
- Hold `Q` and verify smooth leftward rotation.
- Hold `E` and verify smooth rightward rotation.
- Verify that keyboard rotation works simultaneously with WASD movement.
