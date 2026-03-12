# Design: Fix Node Invitation Permissions for Spouses

## Problem
In Issue #56, a mother (May Badran) was unable to invite her children to the family tree, while the father (Karim Hajjaj) could. Investigation revealed that the children were only explicitly linked to the father via `parent` links. Because the mother is linked to the father via a `marriage` link but not directly to the children, the current "1-degree" permission logic filters the children out of her view.

## Proposed Fix
The fix is to update the 1-degree network logic to include children of a spouse, even if they aren't explicitly linked to the current user. This ensures both parents have equal access to their shared children.

### 1. Database Logic Update (PostgreSQL)
Update the `is_within_1_degree` function in `supabase/migrations/` to include a new case:
- **Case 6**: Children of a spouse (User -> Spouse -> Child).

### 2. Frontend Logic Update (TypeScript)
Update `src/lib/permissions.ts` to match the database logic:
- Update `isWithin1Degree` to handle spouse's children.
- Update `get1DegreeNodesSync` to include spouse's children in the generated list.

### 3. Frontend UI Alignment (`FamilyTree.tsx`)
Remove the `isAdmin` restriction from the `inviteForNodeId` prop passed to `BulkInviteModal`. This allows regular members to benefit from the same "pre-select" behavior as admins when they have permission to invite a specific node.

## Success Criteria
- A user can see and invite their children even if the children are only explicitly linked to their spouse.
- The "Invite" button correctly pre-selects a relative when clicked from their profile panel, provided the user has permission.
- No changes to the existing UI or user flow.

## Implementation Details
- Create a new migration: `supabase/migrations/20260312_fix_spouse_child_permissions.sql`.
- Modify `src/lib/permissions.ts`.
- Modify `src/components/FamilyTree.tsx`.
