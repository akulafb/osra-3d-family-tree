# Navigation Controls Improvement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Augment 3D navigation with Q/E rotation and rebind mouse steering toggle to R.

**Architecture:** Update the main navigation loop and event listeners in `FamilyTree3D.tsx` to handle new key bindings and apply yaw rotation to the camera target.

**Tech Stack:** React, Three.js, React-Force-Graph-3D.

---

### Task 1: Rebind Steering Toggle to R

**Files:**
- Modify: `src/components/FamilyTree3D.tsx:720-722`

**Step 1: Replace 'e' toggle with 'r'**

```typescript
// src/components/FamilyTree3D.tsx around line 720
      if (key === 'r') {
        setIsSteeringActive(prev => !prev);
      } else if (key === 'tab') {
```

**Step 2: Commit**

```bash
git add src/components/FamilyTree3D.tsx
git commit -m "feat: rebind steering toggle to R"
```

---

### Task 2: Implement Keyboard Rotation (Q/E)

**Files:**
- Modify: `src/components/FamilyTree3D.tsx:680-700`

**Step 1: Add rotation logic to navigation loop**

```typescript
// src/components/FamilyTree3D.tsx inside navigation flight loop update function
          // 2. Thrust/Strafe (WASD)
          const moveSpeed = keysPressed.current['shift'] ? baseSpeed * boostMultiplier : baseSpeed;
          const forward = new THREE.Vector3();
          camera.getWorldDirection(forward);
          const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
          const moveVec = new THREE.Vector3(0, 0, 0);

          if (keysPressed.current['w'] || keysPressed.current['arrowup']) moveVec.add(forward);
          if (keysPressed.current['s'] || keysPressed.current['arrowdown']) moveVec.add(forward.clone().negate());
          if (keysPressed.current['a'] || keysPressed.current['arrowleft']) moveVec.add(right.clone().negate());
          if (keysPressed.current['d'] || keysPressed.current['arrowright']) moveVec.add(right);

          // 3. Keyboard Rotation (Q/E)
          let kbYaw = 0;
          if (keysPressed.current['q']) kbYaw += turnSpeed;
          if (keysPressed.current['e']) kbYaw -= turnSpeed;

          if (kbYaw !== 0) {
            const direction = new THREE.Vector3().subVectors(controls.target, camera.position);
            direction.applyAxisAngle(camera.up, kbYaw);
            controls.target.addVectors(camera.position, direction);
          }

          if (moveVec.lengthSq() > 0) {
```

**Step 2: Commit**

```bash
git add src/components/FamilyTree3D.tsx
git commit -m "feat: add Q/E keyboard rotation to 3D navigation"
```

---

### Task 3: Update Navigation UI Help

**Files:**
- Modify: `src/components/FamilyTree3D.tsx:1190-1192`

**Step 1: Update labels in Nav Controls overlay**

```typescript
// src/components/FamilyTree3D.tsx around line 1190
            <div style={{ lineHeight: '1.6' }}>
              <div><span style={{ color: isSteeringActive ? '#10b981' : '#fbbf24', fontWeight: 600 }}>R</span>: Mouse Steering <span style={{ color: isSteeringActive ? '#10b981' : '#fbbf24' }}>({isSteeringActive ? 'ACTIVE' : 'LOCKED'})</span></div>
              <div><span style={{ color: '#fff', fontWeight: 600 }}>WASD</span>: Move (Hold <span style={{ color: '#fff', fontWeight: 600 }}>Shift</span> for Boost)</div>
              <div><span style={{ color: '#fff', fontWeight: 600 }}>Q / E</span>: Rotate Left / Right</div>
              <div><span style={{ color: '#fff', fontWeight: 600 }}>Tab</span>: Cycle Names</div>
```

**Step 2: Commit**

```bash
git add src/components/FamilyTree3D.tsx
git commit -m "ui: update nav controls help labels for R/Q/E"
```

---

### Task 4: Final Verification

**Step 1: Manual verification**
- Toggle steering with `R`.
- Rotate with `Q` and `E`.
- Move with `WASD`.

**Step 2: Cleanup orphans**
- Check for any leftover comments or unused logic from the previous `E` toggle if any. (None expected as `E` is being repurposed).

**Step 3: Commit**

```bash
git commit -m "docs: finalize control improvements" --allow-empty
```
