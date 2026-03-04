-- Backfill maternal_family_cluster for children with only 1 parent link.
-- Infer mother from parent's spouse (marriage link): maternal = spouse's paternal cluster.

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
