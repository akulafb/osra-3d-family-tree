-- ============================================================================
-- PUBLIC METRICS RPC FUNCTION
-- ============================================================================
-- This function allows unauthenticated access to tree statistics
-- for the landing page. It bypasses RLS by using SECURITY DEFINER.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_public_metrics()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  individual_count INTEGER;
  family_count INTEGER;
BEGIN
  -- Count total nodes (individuals)
  SELECT COUNT(*) INTO individual_count
  FROM public.nodes;

  -- Count unique family clusters (families)
  SELECT COUNT(DISTINCT paternal_family_cluster) INTO family_count
  FROM public.nodes
  WHERE paternal_family_cluster IS NOT NULL AND paternal_family_cluster != '';

  -- Return as JSON
  RETURN json_build_object(
    'individuals', individual_count,
    'families', family_count
  );
END;
$$;

-- Grant execute permission to anon role (public access)
GRANT EXECUTE ON FUNCTION public.get_public_metrics() TO anon;
