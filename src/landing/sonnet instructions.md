# Osra Node Graph

## Context
Production hero animation for Osra.cc. Reference implementation: provided in chat.
Improve rendering quality; do not deviate from design intent.

---

## Stack
- Three.js r128 via CDN
- Vanilla JS, no build tools
- Single `index.html` (or + `graph.js`)

---

## Visual Design

| Token | Value |
|---|---|
| Background | `#07030f` |
| Node | `#6d28d9`, emissive `#3b0764`, specular `#e9d5ff` |
| Edge core | `#ffffff`, additive blending |
| Edge halo | `#d8b4fe`, additive blending |
| Purple glow | `rgba(196,181,253,0.95)` → `rgba(124,58,237,0.5)` |
| White hover glow | `rgba(255,255,255,1.0)` → `rgba(220,200,255,0.6)` |
| Stars | `#c4b5fd`, 1100pts, 200-unit sphere, opacity 0.3 |
| Fog | `FogExp2(0x07030f, 0.012)` — very light, far nodes visible |

---

## Nodes — 50 total

- Seeded XOR-shift RNG, seed `0xdeadbeef`
- Wide asymmetric spread: X radius `4–17`, Y radius `3.5–11.5` × 0.55 (flat), Z radius `2–8`
- Minimum inter-node distance: `1.8` units
- `SphereGeometry(0.18, 24, 24)`, shared geometry
- Purple glow sprite + white hover glow sprite per node

---

## Edges — sparse

- Each node connects to **2 nearest neighbours** (deduplicated) → ~80–100 edges
- **No buzz effect** — edges are calm, only gentle slinky sway
- Quadratic bezier, 18 segments, rebuilt per frame
- Unique seeded `phase`, `speed` (0.25–0.65), `wobbleAmp` (0.08–0.20), `perp` direction per edge
- Wobble: `sin(t × speed + phase) × wobbleAmp` applied to midpoint along perp
- Opacity breathes: `core = (0.5 + 0.2 × breathe) × vis`, `halo = (0.18 + 0.1 × breathe) × vis`
- Use **Line2 + LineMaterial** (linewidth ~2.5) if available; fallback: dual `THREE.Line`

---

## Scroll Phases

Page: `700vh`. Sticky container: `100vh`.

| Phase | Scroll range | What happens |
|---|---|---|
| Travel | `0.00 → 0.18` | Camera flies through 5 BFS nodes |
| Pullback | `0.18 → 1.00` | Camera zooms out; remaining 45 nodes appear |

The travel phase is intentionally **brief** — just enough for a dramatic close-up before the universe opens up.

---

### Phase 1: Travel (0 → 0.18)

- BFS path from node 0, **5 waypoints only**
- Camera: behind current node, offset toward next along link direction
- Look target: next node in BFS path
- Camera lerp: `0.045`
- Mouse parallax: ±0.35 pos, ±0.18 look
- `fov = 42°`
- Reveal only the 5 BFS nodes during this phase

### Phase 2: Pullback (0.18 → 1.0)

`pullT = (scroll − 0.18) / 0.82`, apply smoothstep easing.

#### Camera final state
```
position: (0, 5.5, 26)
lookAt:   (0, 1.8, 0)
fov:      68°
```

- Camera elevated to Y=5.5 so the graph appears **in the top 50% of the viewport**
- `fov` widens to 68° so the graph fills **full screen width**
- Mouse parallax widens to ±2.0 on position, ±0.6 on lookAt
- Camera transitions smoothly from travel end state using `lerp(start, final, easedPull)`

#### Node flood
All 45 remaining nodes pop in progressively as `revealFront` advances:
`revealFront = 5 + (pullT × 45)` 
Nodes appear with `easeOutBack` scale animation.

---

## Skewer Rotation

Wrap all graph objects (nodes, glows, edge lines) in a `THREE.Group`.

Rotate this group around the **Y axis** (vertical skewer):
```js
graphGroup.rotation.y += rotRate;
```

- During travel phase: `rotRate = 0`
- During pullback: `rotRate` lerps from `0` to `0.0018 rad/frame` using smoothstep(pullT)
- Result: graph begins rotating slowly as it comes into full view, like a slowly spinning universe

**Do not apply mouse rotation to the group** — mouse only affects camera position.

---

## Typography — Lora

All text uses **Lora** (Google Fonts or local files).

**Google Fonts CDN (fallback):**
```html
<link href="https://fonts.googleapis.com/css2?family=Lora:wght@400;700&display=swap" rel="stylesheet">
```

**Local font files (preferred if provided):**
```css
@font-face { font-family: 'Lora'; src: url('fonts/Lora-Regular.woff2') format('woff2'); font-weight: 400; }
@font-face { font-family: 'Lora'; src: url('fonts/Lora-Bold.woff2') format('woff2'); font-weight: 700; }
```

---

## Hero Text Overlay

HTML layer. Not canvas. Two **independent** absolutely-positioned elements.

```
DESKTOP viewport at bottom scroll:
  Top 50vh:    Three.js graph (canvas)
  Middle 25vh: Empty air — intentional, do not fill
  Bottom 25vh: Text zone
    → bottom-left:  #hero-title
    → bottom-right: #hero-body (right-aligned)

MOBILE viewport — three sequential full-screen "slides":
  Slide 1: Graph fills 100vh (travel + pullback)
  Slide 2: "Meet Osra" centred on screen, graph fades to bg
  Slide 3: Descriptive text centred on screen
```

### HTML
```html
<div id="hero-title">Meet Osra</div>
<div id="hero-body">
  <span class="shine">Osra</span> is a beautiful, interactive, and fully immersive family tree experience.
  Built for <span class="shine">privacy and performance</span>, Osra gives every family their own universe
  to explore, in <span class="shine">stunning</span> 3D space.
</div>
```

**"Meet Osra" is plain — no `.shine` on "Osra" in the title. Only the descriptive text has shining words.**

### CSS

```css
/* Shared */
#hero-title, #hero-body {
  position: absolute;
  pointer-events: none;
  z-index: 20;
  opacity: 0;
  transform: translateY(14px);
  transition: opacity 1.4s ease, transform 1.4s ease;
}
.visible { opacity: 1 !important; transform: translateY(0) !important; }

/* Desktop */
#hero-title {
  bottom: 4vh; left: 6vw;
  font-family: 'Lora', Georgia, serif;
  font-weight: 700;
  font-size: clamp(52px, 5.5vw, 88px);
  line-height: 1;
  letter-spacing: -0.015em;
  color: #ede9fe;
  white-space: nowrap;       /* ← single line always */
}
#hero-body {
  bottom: 4vh; right: 6vw;
  text-align: right;
  font-family: 'Lora', Georgia, serif;
  font-weight: 400;
  font-size: clamp(13px, 1.1vw, 18px);
  line-height: 1.7;
  color: #7c5cbf;
  max-width: 40ch;
}

/* Mobile overrides */
@media (max-width: 768px) {
  #hero-title {
    bottom: auto; left: 0; right: 0;
    top: 50%; transform: translateY(calc(-50% + 14px));
    text-align: center;
    font-size: clamp(44px, 11vw, 72px);
  }
  #hero-title.visible { transform: translateY(-50%); }

  #hero-body {
    bottom: auto; left: 0; right: 0;
    top: 50%; transform: translateY(calc(-50% + 14px));
    text-align: center;
    font-size: clamp(14px, 3.8vw, 20px);
    max-width: 80vw;
    margin: 0 auto;
  }
  #hero-body.visible { transform: translateY(-50%); }
}
```

### Staggered Reveal

```js
const IS_MOBILE = window.matchMedia('(max-width: 768px)').matches;

if (IS_MOBILE) {
  // Title appears mid-pullback, disappears before body arrives (clean single-focus)
  const titleIn  = TRAVEL_END + (1 - TRAVEL_END) * 0.50; // ~0.59
  const titleOut = TRAVEL_END + (1 - TRAVEL_END) * 0.68; // ~0.74
  const bodyIn   = TRAVEL_END + (1 - TRAVEL_END) * 0.76; // ~0.80
  heroTitleEl.classList.toggle('visible', scrollSmooth > titleIn && scrollSmooth < titleOut);
  heroBodyEl.classList.toggle('visible',  scrollSmooth > bodyIn);
} else {
  // Desktop: title ~0.80, body ~0.90
  heroTitleEl.classList.toggle('visible', scrollSmooth > TRAVEL_END + 0.82 * 0.76);
  heroBodyEl.classList.toggle('visible',  scrollSmooth > TRAVEL_END + 0.82 * 0.88);
}
```

---

## Hover

- Raycaster on mousemove, only visible nodes (`nodeVisible[i] > 0.3`)
- `hoverCurrent` lerps at `dt × 3.5` (~1s ramp)
- White glow: `opacity = hoverCurrent × nodeVisible × 0.92`, scale `(2.2 + hoverCurrent × 1.8) × nodeVisible`
- `emissiveIntensity`: `0.7 + hoverCurrent × 2.5`
- Colour shifts to `#9f7aea` when `hoverCurrent > 0.3`
- One node at a time

---

## Priority Improvements Over Reference
1. **Line2** for true GPU thickness (biggest visual upgrade)
2. Smooth camera transition from travel end position into pullback start — no jump
3. Hover ramp exactly ~1 second, smooth curve not step
4. Skewer rotation should feel weightless — not mechanical

---

## Output
`index.html` (+ optional `graph.js`) — static, no build tools.
