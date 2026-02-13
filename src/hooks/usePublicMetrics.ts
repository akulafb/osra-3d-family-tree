import { useEffect, useState } from 'react';

interface PublicMetrics {
  individuals: number;
  families: number;
  isLoading: boolean;
  hasError: boolean;
}

export function usePublicMetrics(): PublicMetrics {
  const [metrics, setMetrics] = useState<PublicMetrics>({
    individuals: 0,
    families: 0,
    isLoading: true,
    hasError: false,
  });

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
          // Hide component if env vars not set
          setMetrics({
            individuals: 0,
            families: 0,
            isLoading: false,
            hasError: true,
          });
          return;
        }

        // Fetch node count (individuals)
        const nodesResponse = await fetch(
          `${supabaseUrl}/rest/v1/nodes?select=id`,
          {
            method: 'GET',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
            },
          }
        );

        if (!nodesResponse.ok) {
          throw new Error('Failed to fetch node count');
        }

        const nodes = await nodesResponse.json();
        const individualCount = nodes?.length || 0;

        // Fetch unique family clusters (families)
        const clustersResponse = await fetch(
          `${supabaseUrl}/rest/v1/nodes?select=family_cluster`,
          {
            method: 'GET',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
            },
          }
        );

        if (!clustersResponse.ok) {
          throw new Error('Failed to fetch family clusters');
        }

        const clusterData = await clustersResponse.json();
        const uniqueFamilies = new Set(
          clusterData
            ?.map((n: any) => n.family_cluster)
            .filter((c: string | null) => c && c.trim() !== '')
        );
        const familyCount = uniqueFamilies.size;

        setMetrics({
          individuals: individualCount,
          families: familyCount,
          isLoading: false,
          hasError: false,
        });
      } catch (err) {
        console.error('[usePublicMetrics] Error:', err);
        // Hide component on error
        setMetrics({
          individuals: 0,
          families: 0,
          isLoading: false,
          hasError: true,
        });
      }
    };

    fetchMetrics();
  }, []);

  return metrics;
}
