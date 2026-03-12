# Fix Spouse Child Permissions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ensure parents can invite their children even if the children are only explicitly linked to their spouse.

**Architecture:** Update the "1-degree" network logic in both the frontend (TypeScript) and backend (PostgreSQL RLS) to include children of a spouse. Align the frontend UI to allow regular members to pre-select relatives in the invite modal.

**Tech Stack:** TypeScript, React, Supabase (PostgreSQL/RLS)

---

### Task 1: Update Frontend Permission Helper

**Files:**
- Modify: `src/lib/permissions.ts:63-108`

**Step 1: Update `isWithin1Degree` to handle spouse's children**

```typescript
// Add Case 6: Spouse's children
const userSpouses = links.filter((link: any) => {
  const s = getSafeId(link.source);
  const t = getSafeId(link.target);
  return (link.type === 'marriage' || link.type === 'divorce') && 
         (s === userNodeId || t === userNodeId);
}).map((link: any) => {
  const s = getSafeId(link.source);
  return s === userNodeId ? getSafeId(link.target) : s;
});

const isSpousesChild = userSpouses.some(spouseId => 
  spouseId && links.some((link: any) => {
    const s = getSafeId(link.source);
    const t = getSafeId(link.target);
    return link.type === 'parent' && s === spouseId && t === targetNodeId;
  })
);

if (isSpousesChild) return true;
```

**Step 2: Update `get1DegreeNodesSync` to include spouse's children**

```typescript
// Add Spouse's children
const userSpouses = links.filter((link: any) => {
  const s = getSafeId(link.source);
  const t = getSafeId(link.target);
  return (link.type === 'marriage' || link.type === 'divorce') && 
         (s === userNodeId || t === userNodeId);
}).map((link: any) => {
  const s = getSafeId(link.source);
  return s === userNodeId ? getSafeId(link.target) : s;
});

userSpouses.forEach(spouseId => {
  if (!spouseId) return;
  const spouseChildren = getChildren(spouseId, links);
  spouseChildren.forEach(id => oneDegreeIds.add(id));
});
```

**Step 3: Commit**

```bash
git add src/lib/permissions.ts
git commit -m "feat: Add spouse's children to 1-degree permission logic"
```

---

### Task 2: Update Database RLS Logic

**Files:**
- Create: `supabase/migrations/20260312_fix_spouse_child_permissions.sql`

**Step 1: Create migration to update `is_within_1_degree`**

```sql
-- Case 6: Child of a Spouse
IF EXISTS (
    SELECT 1 
    FROM public.links l_marriage
    JOIN public.links l_spouse_child ON (l_spouse_child.source_node_id = l_marriage.source_node_id OR l_spouse_child.source_node_id = l_marriage.target_node_id)
    WHERE (l_marriage.source_node_id = user_node_id OR l_marriage.target_node_id = user_node_id)
      AND (l_marriage.type = 'marriage' OR l_marriage.type = 'divorce')
      AND l_spouse_child.type = 'parent'
      AND l_spouse_child.target_node_id = p_target_node_id
      AND l_spouse_child.source_node_id != user_node_id -- Ensure we don't count direct parent again (though redundant)
) THEN
    RETURN TRUE;
END IF;
```

**Step 2: Commit**

```bash
git add supabase/migrations/20260312_fix_spouse_child_permissions.sql
git commit -m "fix: Add spouse's children to database is_within_1_degree logic"
```

---

### Task 3: Align Frontend UI Invitation Behavior

**Files:**
- Modify: `src/components/FamilyTree.tsx:325`

**Step 1: Remove `isAdmin` check from `inviteForNodeId`**

```typescript
inviteForNodeId={selectedNode && selectedNode.id !== userProfile.node_id && canManageInvites(selectedNode.id, userProfile.node_id, userProfile.role === 'admin', (graphData?.links ?? []) as FamilyLink[]) ? selectedNode.id : undefined}
```

**Step 2: Commit**

```bash
git add src/components/FamilyTree.tsx
git commit -m "feat: Allow non-admins to pre-select relatives in invite modal"
```
