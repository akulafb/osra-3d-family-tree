# Divorce Link Type Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Introduce a new 'divorce' link type that appears as a gray dotted line in both 3D and 2D views, and update Hisham Shaban and Hala Badran to use this type.

**Architecture:** Update the database schema check constraint, update TypeScript types for consistency, and modify frontend rendering logic in both ForceGraph3D and D3-based 2D views to support the new visual style.

**Tech Stack:** React, TypeScript, Three.js (react-force-graph-3d), D3.js, Supabase/PostgreSQL.

---

### Task 1: Database and Type Definitions

**Files:**
- Modify: `src/types/database.ts:63, 71, 79`
- Modify: `src/types/graph.ts:14, 34`
- Modify: `src/lib/permissions.ts:7, 192`

**Step 1: Update `src/types/database.ts`**
Add `'divorce'` to the `type` union in `links` table.

```typescript
// src/types/database.ts
// ... inside links Row, Insert, Update
type: 'parent' | 'marriage' | 'divorce';
```

**Step 2: Update `src/types/graph.ts`**
Add `'divorce'` to `FamilyLink` and `Link2D`.

```typescript
// src/types/graph.ts
export interface FamilyLink {
  source: string;
  target: string;
  type: 'parent' | 'marriage' | 'divorce';
}

export interface Link2D {
  source: Node2D;
  target: Node2D;
  type: 'parent' | 'marriage' | 'divorce';
  path: string;
}
```

**Step 3: Update `src/lib/permissions.ts`**
Add `'divorce'` to `RelationshipType` and `canCreateLink`.

```typescript
// src/lib/permissions.ts
export type RelationshipType = 'self' | 'parent' | 'child' | 'spouse' | 'sibling' | 'divorce' | 'unrelated';

export function canCreateLink(
  sourceNodeId: string,
  targetNodeId: string,
  _linkType: 'parent' | 'sibling' | 'marriage' | 'divorce',
  // ...
)
```

**Step 4: Commit**
```bash
git add src/types/database.ts src/types/graph.ts src/lib/permissions.ts
git commit -m "chore: add divorce to type definitions"
```

---

### Task 2: 3D Frontend Rendering

**Files:**
- Modify: `src/components/FamilyTree3D.tsx:990, 991, 992`

**Step 1: Update Link Color and Style in `FamilyTree3D.tsx`**
Update `linkColor`, `linkWidth`, and add `linkDashArray`.

```typescript
// src/components/FamilyTree3D.tsx inside <ForceGraph3DAny />
linkColor={(l: any) => {
  if (l.type === 'marriage') return '#f59e0b';
  if (l.type === 'divorce') return '#9ca3af'; // gray-400
  return '#60a5fa';
}}
linkWidth={(l: any) => {
  if (l.type === 'marriage' || l.type === 'divorce') return 3;
  return 1.5;
}}
linkDashArray={(l: any) => l.type === 'divorce' ? [3, 2] : null}
```

**Step 2: Commit**
```bash
git add src/components/FamilyTree3D.tsx
git commit -m "feat: render divorce links as gray dotted lines in 3D"
```

---

### Task 3: 2D Frontend Rendering

**Files:**
- Modify: `src/components/OrthogonalLinks.tsx:53, 56, 68`

**Step 1: Update `OrthogonalLinks.tsx`**
Add support for `'divorce'` type with gray color and `strokeDasharray`.

```typescript
// src/components/OrthogonalLinks.tsx
const isMarriage = link.type === 'marriage';
const isDivorce = link.type === 'divorce';

const baseColor = isMarriage
  ? '#f59e0b'
  : (isDivorce ? '#9ca3af' : getClusterColor(link.source.familyCluster));

const strokeWidth = (isMarriage || isDivorce) ? 2.5 : 1.5;
// ...
return (
  <path
    // ...
    strokeDasharray={isDivorce ? "5,5" : "none"}
  />
);
```

**Step 2: Commit**
```bash
git add src/components/OrthogonalLinks.tsx
git commit -m "feat: render divorce links as gray dotted lines in 2D"
```

---

### Task 4: Data Update (Seed & JSON)

**Files:**
- Create: `supabase/migrations/20260223_add_divorce_type.sql`
- Modify: `supabase/seed/bulk-upload-1-seed.sql:160`
- Modify: `src/data/familyData.json:151`

**Step 1: Create SQL Migration**
```sql
-- supabase/migrations/20260223_add_divorce_type.sql
ALTER TABLE links DROP CONSTRAINT IF EXISTS links_type_check;
ALTER TABLE links ADD CONSTRAINT links_type_check CHECK (type IN ('parent', 'marriage', 'divorce'));

-- Update Hisham & Hala link (assuming IDs from seed)
UPDATE links 
SET type = 'divorce' 
WHERE source_node_id = '10000000-1000-4000-8000-00000000001b' 
  AND target_node_id = '10000000-1000-4000-8000-000000000018';
```

**Step 2: Update `supabase/seed/bulk-upload-1-seed.sql`**
```sql
-- line 160
('10000000-1000-4000-8000-00000000001b', '10000000-1000-4000-8000-000000000018', 'divorce', '00000000-0000-0000-0000-000000000001', NOW()),
```

**Step 3: Update `src/data/familyData.json`**
```json
// Find the link between Hisham (27) and Hala (24)
{ "source": 27, "target": 24, "type": "divorce" }
```

**Step 4: Commit**
```bash
git add supabase/migrations/20260223_add_divorce_type.sql supabase/seed/bulk-upload-1-seed.sql src/data/familyData.json
git commit -m "data: update Hisham and Hala relationship to divorce"
```

---

### Task 5: Verification

**Steps:**
1. Check for compiler errors: `npm run tsc` (if available) or check IDE lints.
2. Run dev server: `npm run dev`.
3. Open browser and navigate to the tree.
4. Find Hisham Shaban and Hala Badran.
5. Verify link is gray and dotted in 3D mode.
6. Switch to 2D mode, select the 'Shaban' or 'Badran' family, and verify the link is gray and dotted there as well.
