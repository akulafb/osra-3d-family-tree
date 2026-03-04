-- Enhancement #1: Paternal and maternal family clusters for 2D maternal-children display

-- 1. Rename family_cluster to paternal_family_cluster, add maternal_family_cluster
ALTER TABLE public.nodes RENAME COLUMN family_cluster TO paternal_family_cluster;
ALTER TABLE public.nodes ADD COLUMN maternal_family_cluster text;

-- 2. Add parent_role to links (mother/father for parent-type links)
ALTER TABLE public.links ADD COLUMN parent_role text
  CHECK (parent_role IS NULL OR parent_role IN ('mother', 'father'));
