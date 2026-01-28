# Force-Directed Graphs - Brief Overview

## Core Concept

Force-directed graph algorithms position nodes in space by simulating physical forces, creating natural layouts where connected nodes cluster together and unconnected nodes repel.

## Key Forces

1. **Attraction Force** (along links/edges)
   - Pulls connected nodes together
   - Strength typically proportional to link weight or inversely proportional to desired distance
   - Formula: `F_attraction = k * (d - d0)` where `d` is current distance, `d0` is target distance

2. **Repulsion Force** (between all nodes)
   - Pushes all nodes apart to prevent overlap
   - Typically follows inverse square law: `F_repulsion = k / d²`
   - Creates spacing and prevents clustering too tightly

3. **Collision Avoidance**
   - Additional constraint to maintain minimum node separation
   - Prevents visual overlap

## Algorithms

**Fruchterman-Reingold**: Classic algorithm balancing attraction/repulsion with temperature-based cooling (simulated annealing approach).

**Barnes-Hut** (used by d3-force-3d): Optimized for large graphs using quadtree/octree spatial partitioning - treats distant node groups as single particles, reducing O(n²) to O(n log n).

## 3D vs 2D

- **More space**: Z-axis provides additional dimension for separation
- **Better clustering**: Family clusters can naturally separate in 3D space
- **Visual clarity**: Marriage links bridging clusters are more visible when clusters are separated along z-axis
- **Physics**: Same force calculations, just with z-component added

## Key Parameters (d3-force-3d)

- **linkDistance**: Target distance between connected nodes
- **linkStrength**: How strongly links enforce their target distance (0-1)
- **charge/repulsion**: Strength of repulsive force between nodes
- **center**: Gravity-like force pulling nodes toward origin
- **collision**: Minimum radius to prevent node overlap

## For Our Project

We'll configure:
- **Short linkDistance** for parent/sibling links (keep families close)
- **Long linkDistance** for marriage links (bridge between clusters)
- **Strong repulsion** to separate different family clusters
- **Weak linkStrength** for marriage links (flexible bridges)

The physics simulation runs iteratively until forces reach equilibrium (or max iterations), creating natural 3D clustering.
