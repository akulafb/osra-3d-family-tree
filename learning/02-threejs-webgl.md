# Three.js & WebGL Basics

## WebGL Fundamentals

**WebGL** = JavaScript API for rendering 3D graphics in the browser using the GPU.

- Low-level: Works with shaders (vertex/fragment), buffers, textures
- Hardware-accelerated: Leverages GPU for performance
- Direct: You manage rendering pipeline manually

## Three.js - The Abstraction Layer

Three.js provides a high-level API over WebGL, making 3D development accessible.

### Core Components

1. **Scene**: Container for all 3D objects, lights, cameras
   ```javascript
   const scene = new THREE.Scene();
   ```

2. **Camera**: Defines viewpoint (perspective or orthographic)
   ```javascript
   const camera = new THREE.PerspectiveCamera(75, width/height, 0.1, 1000);
   ```

3. **Renderer**: Draws the scene to canvas using WebGL
   ```javascript
   const renderer = new THREE.WebGLRenderer({ canvas });
   renderer.render(scene, camera);
   ```

4. **Mesh**: 3D object = Geometry (shape) + Material (appearance)
   ```javascript
   const geometry = new THREE.SphereGeometry(1);
   const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
   const mesh = new THREE.Mesh(geometry, material);
   scene.add(mesh);
   ```

### Animation Loop

```javascript
function animate() {
  requestAnimationFrame(animate);
  // Update objects/camera
  renderer.render(scene, camera);
}
animate();
```

## react-force-graph-3d Abstraction

`react-force-graph-3d` handles all Three.js complexity:

- **Automatically creates**: Scene, Camera, Renderer
- **Manages**: Node meshes, link geometries, force simulation
- **Provides**: React component interface
- **Exposes**: Configuration props and event handlers

You don't directly interact with Three.js objects, but understanding them helps when:
- Customizing node appearance
- Adding custom 3D objects
- Implementing camera animations
- Debugging rendering issues

## OrbitControls

Built-in Three.js control for camera navigation (used by react-force-graph-3d):

- **Orbit**: Rotate camera around a target point (left mouse drag)
- **Zoom**: Move camera closer/farther (mouse wheel)
- **Pan**: Translate camera (right mouse drag or arrow keys)

Key properties:
- `enableDamping`: Smooth, weighted camera movement (inertia)
- `autoRotate`: Automatic orbiting
- `minDistance`/`maxDistance`: Zoom limits
- `minPolarAngle`/`maxPolarAngle`: Vertical rotation limits

## For Our Project

react-force-graph-3d provides OrbitControls by default. We'll:
- Use built-in navigation (orbit, zoom, pan)
- Customize camera behavior via component props
- Implement click-to-focus using camera position interpolation
- Potentially add custom Three.js objects (e.g., labels, custom node shapes)
