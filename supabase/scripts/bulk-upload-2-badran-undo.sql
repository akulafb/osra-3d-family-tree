-- ============================================================================
-- UNDO: Remove Badran additions (nodes 75-309 and their links)
-- Run in Supabase SQL Editor if you need to revert.
-- ============================================================================

-- Delete links that reference new nodes (75-309, UUID suffix 04b..135)
DELETE FROM public.links
WHERE source_node_id::text >= '10000000-1000-4000-8000-00000000004b'
   OR target_node_id::text >= '10000000-1000-4000-8000-00000000004b';

-- Delete new nodes (75-418, hex 04b..1a2)
DELETE FROM public.nodes
WHERE id::text >= '10000000-1000-4000-8000-00000000004b'
  AND id::text <= '10000000-1000-4000-8000-0000000001a2';
