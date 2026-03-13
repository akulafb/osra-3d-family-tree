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
        console.error('[useFamilyData] Nodes fetch failed:', nodesResponse.status, nodesResponse.statusText);
        throw new Error('Failed to load family data');
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
      
      if (!linksResponse.ok) {
        const errorText = await linksResponse.text();
        console.error('[useFamilyData] Links fetch failed:', linksResponse.status, errorText);
        throw new Error('Failed to load family data');
      }

      const linksData = await linksResponse.json();

      // Fetch claimed node IDs via RPC (bypasses RLS)
      let claimedNodeIds = new Set<string>();
      try {
        const claimedRes = await fetch(
          `${supabaseUrl}/rest/v1/rpc/get_claimed_node_ids`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseKey,
              'Authorization': `Bearer ${authToken}`,
            },
            body: '{}',
          }
        );
        if (claimedRes.ok) {
          const claimed = await claimedRes.json();
          if (Array.isArray(claimed)) {
            claimedNodeIds = new Set(claimed.filter(Boolean).map(String));
          }
        }
      } catch (err) {
        // Non-fatal: tree still works without claim indicators
      }

      if (!nodesData || nodesData.length === 0) {
        console.warn('[useFamilyData] No nodes returned from Supabase');
      }

      // Transform Supabase data to FamilyGraph format
      const nodes: FamilyNode[] = (nodesData || []).map((node: any) => ({
        id: node.id,
        name: node.name,
        familyCluster: node.paternal_family_cluster ?? node.family_cluster ?? undefined,
        maternalFamilyCluster: node.maternal_family_cluster || undefined,
        isClaimed: claimedNodeIds.has(String(node.id)),
      }));

      const links: FamilyLink[] = (linksData || []).map((link: any) => ({
        source: link.source_node_id,
        target: link.target_node_id,
        type: link.type as 'parent' | 'marriage' | 'divorce',
        parentRole: link.parent_role || undefined,
      }));

      setGraphData({ nodes, links });
      setIsLoading(false);
    } catch (err) {
      console.error('[useFamilyData] Error fetching family data:', err);
      setError('Failed to load family data');
      setIsLoading(false);
    }
  };

  const refetch = () => {
    fetchFamilyData();
  };

  return { graphData, isLoading, error, refetch };
}
