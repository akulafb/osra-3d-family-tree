import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { FamilyGraph, FamilyNode, FamilyLink } from '../types/graph';

export function useFamilyData() {
  const [graphData, setGraphData] = useState<FamilyGraph | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFamilyData();
  }, []);

  const fetchFamilyData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch nodes
      const { data: nodesData, error: nodesError } = await supabase
        .from('nodes')
        .select('*')
        .order('created_at');

      if (nodesError) throw nodesError;

      // Fetch links
      const { data: linksData, error: linksError } = await supabase
        .from('links')
        .select('*')
        .order('created_at');

      if (linksError) throw linksError;

      // Transform Supabase data to FamilyGraph format
      const nodes: FamilyNode[] = (nodesData || []).map(node => ({
        id: node.id,
        name: node.name,
        familyCluster: node.family_cluster || undefined,
      }));

      const links: FamilyLink[] = (linksData || []).map(link => ({
        source: link.source_node_id,
        target: link.target_node_id,
        type: link.type as 'parent' | 'marriage',
      }));

      setGraphData({ nodes, links });
      setIsLoading(false);
    } catch (err) {
      console.error('Error fetching family data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load family data');
      setIsLoading(false);
    }
  };

  const refetch = () => {
    fetchFamilyData();
  };

  return { graphData, isLoading, error, refetch };
}
