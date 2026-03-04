-- Backfill maternal_family_cluster from graph: child's maternal = mother's paternal cluster.
-- Case 1: Nodes with 2 parents - the parent whose cluster differs from child's paternal is the mother.
UPDATE public.nodes child
SET maternal_family_cluster = mother.paternal_family_cluster
FROM (
  SELECT
    child.id AS child_id,
    p_other.paternal_family_cluster
  FROM public.nodes child
  JOIN public.links l1 ON l1.target_node_id = child.id AND l1.type = 'parent'
  JOIN public.nodes p1 ON p1.id = l1.source_node_id
  JOIN public.links l2 ON l2.target_node_id = child.id AND l2.type = 'parent' AND l2.source_node_id != l1.source_node_id
  JOIN public.nodes p_other ON p_other.id = l2.source_node_id
  WHERE child.paternal_family_cluster = p1.paternal_family_cluster
    AND p_other.paternal_family_cluster IS NOT NULL
    AND p_other.paternal_family_cluster != child.paternal_family_cluster
) mother
WHERE child.id = mother.child_id;

-- Case 2: Nodes with 1 parent - infer mother from parent's spouse (marriage link).
-- Child's paternal = father's cluster; father's spouse = mother; maternal = mother's cluster.
UPDATE public.nodes child
SET maternal_family_cluster = spouse.paternal_family_cluster
FROM (
  SELECT
    child.id AS child_id,
    p_spouse.paternal_family_cluster
  FROM public.nodes child
  JOIN public.links l_parent ON l_parent.target_node_id = child.id AND l_parent.type = 'parent'
  JOIN public.nodes p_father ON p_father.id = l_parent.source_node_id
  JOIN public.links l_marriage ON l_marriage.type = 'marriage'
    AND (l_marriage.source_node_id = p_father.id OR l_marriage.target_node_id = p_father.id)
  JOIN public.nodes p_spouse ON p_spouse.id = CASE
    WHEN l_marriage.source_node_id = p_father.id THEN l_marriage.target_node_id
    ELSE l_marriage.source_node_id
  END
  WHERE child.paternal_family_cluster = p_father.paternal_family_cluster
    AND p_spouse.paternal_family_cluster IS NOT NULL
    AND p_spouse.paternal_family_cluster != child.paternal_family_cluster
    AND NOT EXISTS (
      SELECT 1 FROM public.links l2
      WHERE l2.target_node_id = child.id AND l2.type = 'parent' AND l2.source_node_id != p_father.id
    )
) spouse
WHERE child.id = spouse.child_id;
