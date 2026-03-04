-- Update get_public_metrics to use paternal_family_cluster after column rename

CREATE OR REPLACE FUNCTION public.get_public_metrics()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  individual_count INTEGER;
  family_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO individual_count FROM public.nodes;
  SELECT COUNT(DISTINCT paternal_family_cluster) INTO family_count FROM public.nodes
  WHERE paternal_family_cluster IS NOT NULL AND paternal_family_cluster != '';
  RETURN json_build_object('individuals', individual_count, 'families', family_count);
END;
$$;
