# Design Doc: Divorce Link Type

## Overview
Introduce a new `'divorce'` link type to the family tree to represent divorced couples. These links will be visually distinct from active marriage links, appearing as gray dotted lines in both 3D and 2D views.

## User Requirements
- New link type for divorced couples.
- Appearance: Gray and dotted (same as marriage except for style and color).
- Specifically update Hisham Shaban and Hala Badran to be divorced.
- Minimal backend and frontend changes.

## Database Changes
- SQL Migration script to update the `links` table `type` check constraint.
- Update `supabase-seed.sql` to reflect the change for Hisham & Hala.

## Backend/Type Changes
- Update `src/types/database.ts` to include `'divorce'` in the `links` table type definition.
- Update `src/types/graph.ts` to include `'divorce'` in `FamilyLink` and `Link2D`.
- Update `src/lib/permissions.ts` to include `'divorce'` in `RelationshipType` and relevant permission logic.

## Frontend Changes
- **3D View (`FamilyTree3D.tsx`):**
  - Add logic to handle `'divorce'` type in `linkColor`.
  - Use `linkDashArray` to make the link dotted.
- **2D View (`OrthogonalLinks.tsx`):**
  - Add logic to handle `'divorce'` type in color and stroke style.
  - Use `stroke-dasharray` for the dotted effect.

## Data Changes
- Update `src/data/familyData.json` to change the link type for Hisham & Hala to `'divorce'`.

## Success Criteria
1. Hisham Shaban and Hala Badran are linked by a gray dotted line.
2. The application builds and runs without TypeScript or runtime errors.
3. The database schema correctly accepts the new type.
