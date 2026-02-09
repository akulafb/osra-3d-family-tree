import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { FamilyGraph, FamilyNode, FamilyLink } from '../types/graph';

export function useFamilyData() {
  const { session } = useAuth();
  const [graphData, setGraphData] = useState<FamilyGraph | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session) {
      fetchFamilyData();
    }
  }, [session]);

  const fetchFamilyData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('[useFamilyData] Fetching nodes and links...');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      // Use authenticated session token to pass RLS policies
      const authToken = session?.access_token || supabaseKey;

      // Fetch nodes using raw fetch (avoid Supabase client websocket hang)
      const nodesResponse = await fetch(
        `${supabaseUrl}/rest/v1/nodes?order=created_at.asc&select=*`,
        {
          method: 'GET',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${authToken}`,
          },
        }
      );

      if (!nodesResponse.ok) {
        throw new Error(`Failed to fetch nodes: ${nodesResponse.statusText}`);
      }

      const nodesData = await nodesResponse.json();

      // Fetch links using raw fetch
      const linksResponse = await fetch(
        `${supabaseUrl}/rest/v1/links?order=created_at.asc&select=*`,
        {
          method: 'GET',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${authToken}`,
          },
        }
      );

      console.log('[useFamilyData] Links response status:', linksResponse.status, linksResponse.statusText);
      
      if (!linksResponse.ok) {
        const errorText = await linksResponse.text();
        console.error('[useFamilyData] Links fetch failed:', errorText);
        throw new Error(`Failed to fetch links: ${linksResponse.statusText}`);
      }

      const linksData = await linksResponse.json();
      console.log('[useFamilyData] Raw links count from API:', linksData?.length);
      console.log('[useFamilyData] First link raw:', linksData?.[0]);

      // Transform Supabase data to FamilyGraph format
      const nodes: FamilyNode[] = (nodesData || []).map(node => ({
        id: node.id,
        name: node.name,
        familyCluster: node.family_cluster || undefined,
      }));

      const links: FamilyLink[] = (linksData || []).map((link, idx) => {
        if (idx < 3) {
          console.log(`[useFamilyData] Transforming link ${idx}:`, link);
        }
        return {
          source: link.source_node_id,
          target: link.target_node_id,
          type: link.type as 'parent' | 'marriage',
        };
      });

      console.log('[useFamilyData] Transformed links count:', links.length);
      console.log('[useFamilyData] First transformed link:', links[0]);
      
      // Check if user's links exist
      const userNodeId = '10000000-1000-4000-8000-000000000003';
      const userLinks = links.filter(l => l.source === userNodeId || l.target === userNodeId);
      console.log(`[useFamilyData] Links for ${userNodeId}:`, userLinks.length, userLinks);

      setGraphData({ nodes, links });
      console.log('[useFamilyData] Loaded:', { nodes: nodes.length, links: links.length });
      setIsLoading(false);
    } catch (err) {
      console.error('[useFamilyData] Error fetching family data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load family data');
      setIsLoading(false);
    }
  };

  const refetch = () => {
    fetchFamilyData();
  };

  return { graphData, isLoading, error, refetch };
}
