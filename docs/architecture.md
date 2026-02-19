# 3D Family Tree — How It Works

High-level architecture of the app: UI → Auth → Data & permissions → Supabase backend → 3D scene.

## Diagram (Mermaid)

```mermaid
flowchart TB
  subgraph UI["UI Layer"]
    User["User / Browser"]
    App["App.tsx Routes"]
    Home["HomePage: Landing | Invite? | Tree"]
    InvitePage["InvitePage"]
  end

  subgraph Auth["Auth & Identity"]
    AuthContext["AuthContext: session, userProfile, node_id"]
    SupabaseAuth["Supabase Auth (Google OAuth)"]
  end

  subgraph Data["Data & Permissions"]
    useFamilyData["useFamilyData: nodes + links"]
    permissions["permissions: 1-degree, canEdit"]
  end

  subgraph Backend["Supabase (Backend)"]
    users["users"]
    nodes["nodes"]
    links["links"]
    node_invites["node_invites"]
    RLS["RLS: 1-degree access"]
  end

  subgraph Scene["3D Scene (FamilyTree3D)"]
    ForceGraph3D["ForceGraph3D: scene, camera, nodeThreeObject"]
    starfield["createStarfield (parallax)"]
    filteredGraphData["filteredGraphData"]
    FamilyChat["FamilyChat (LLM)"]
  end

  User --> App --> Home
  Home --> InvitePage
  AuthContext --> SupabaseAuth
  AuthContext -.->|session| Backend
  useFamilyData --> permissions
  Data -.->|REST + Bearer| Backend
  Data -.->|graphData| Scene
  ForceGraph3D --> starfield
  filteredGraphData --> ForceGraph3D
  FamilyChat --> Scene
```

## Notes

- **Invite flow**: User claims invite token → `users.node_id` is set. RLS filters `nodes` and `links` by 1-degree access.
- **3D scene**: `FamilyTree3D` uses `ForceGraph3D`, `createStarfield` (parallax), `filteredGraphData`, and `FamilyChat` (LLM).

## Excalidraw source

The same diagram is stored as Excalidraw-style JSON in this repo:  
[`docs/3d-family-tree-architecture.excalidraw.json`](./3d-family-tree-architecture.excalidraw.json)  
(Checkpoint id from Cursor Excalidraw MCP: `ada2b498a5674157b1`.)
