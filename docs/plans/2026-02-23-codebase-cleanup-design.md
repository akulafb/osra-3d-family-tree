# Design Document: Codebase Cleanup (Surgical)

## Overview
This design outlines a surgical cleanup of the **Osra** 3D Family Tree codebase. The goal is to remove unused files, redundant dependencies, and excessive debugging logs to improve maintainability while ensuring 100% feature parity.

## Success Criteria
- [ ] Unused components and hooks are removed from the repository.
- [ ] `three-nebula` dependency is removed.
- [ ] `package.json` and `package-lock.json` are updated.
- [ ] Noisy `console.log` statements are removed from production-critical paths.
- [ ] `README.md` project structure is updated and accurate.
- [ ] Application remains fully functional (3D/2D views, Auth, Chat, Modals).

## Scope

### 1. File Deletions
The following files have been identified as obsolete or redundant:
- `src/components/ViewModeToggle.tsx`
- `src/landing/HeroSection.tsx`
- `src/landing/MetricsSection.tsx`
- `src/landing/SequenceViewer.tsx`
- `src/hooks/useImageSequence.ts`
- `src/data/familyData.json`

### 2. Dependency Management
- Uninstall `three-nebula`.
- Verify `starfield.ts` still functions (it uses a custom implementation).

### 3. Log Cleanup
Reduce console noise by removing non-essential `console.log` calls in:
- `src/hooks/useFamilyData.ts` (API fetch details)
- `src/contexts/AuthContext.tsx` (Auth state change details)
- `src/lib/supabase.ts` (Initialization logs)
- `src/components/modals/` (RPC result logs)
- `src/pages/InvitePage.tsx` (Token validation logs)

### 4. Documentation Updates
- Sync the `README.md` "Project Structure" with the actual file tree.
- Remove references to the "Cinematic scroll sequence" frames which are no longer present.

## Risks & Mitigations
- **Risk**: Deleting a file that is indirectly used.
- **Mitigation**: Perform a final grep/find-references check for each file before deletion.
- **Risk**: Breaking 3D background if `three-nebula` was secretly used.
- **Mitigation**: Verified `src/utils/starfield.ts` uses custom `PerlinNoise` and `THREE` directly.
