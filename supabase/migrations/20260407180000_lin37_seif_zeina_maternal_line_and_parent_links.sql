-- LIN-37: Seif & Zeina Shaban — maternal line + explicit mother parent edges + father roles.
-- Seed UUIDs (bulk-upload-1): Hala 018, Hisham 01b, Seif 01c, Zeina 01d

UPDATE public.nodes
SET maternal_family_cluster = 'Badran'
WHERE id IN (
  '10000000-1000-4000-8000-00000000001c',
  '10000000-1000-4000-8000-00000000001d'
);

UPDATE public.links
SET parent_role = 'father'
WHERE type = 'parent'
  AND source_node_id = '10000000-1000-4000-8000-00000000001b'
  AND target_node_id IN (
    '10000000-1000-4000-8000-00000000001c',
    '10000000-1000-4000-8000-00000000001d'
  );

INSERT INTO public.links (source_node_id, target_node_id, type, parent_role)
SELECT '10000000-1000-4000-8000-000000000018', '10000000-1000-4000-8000-00000000001c', 'parent', 'mother'
WHERE NOT EXISTS (
  SELECT 1 FROM public.links
  WHERE source_node_id = '10000000-1000-4000-8000-000000000018'
    AND target_node_id = '10000000-1000-4000-8000-00000000001c'
    AND type = 'parent'
);

INSERT INTO public.links (source_node_id, target_node_id, type, parent_role)
SELECT '10000000-1000-4000-8000-000000000018', '10000000-1000-4000-8000-00000000001d', 'parent', 'mother'
WHERE NOT EXISTS (
  SELECT 1 FROM public.links
  WHERE source_node_id = '10000000-1000-4000-8000-000000000018'
    AND target_node_id = '10000000-1000-4000-8000-00000000001d'
    AND type = 'parent'
);
