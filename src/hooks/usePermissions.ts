import { useState, useEffect, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { 
  canEditNode, 
  get1DegreeNodes, 
  getNodeRelationship,
  RelationshipType
} from '../lib/permissions';
import { supabase } from '../lib/supabase';

interface PermissionUtils {
  canEdit: (targetNodeId: string) => Promise<boolean>;
  get1DegreeNetwork: () => Promise<string[]>;
  getRelationship: (targetNodeId: string) => Promise<{
    type: RelationshipType;
    label: string;
  }>;
  isAdmin: () => Promise<boolean>;
}

interface PermissionState {
  canEdit: boolean;
  isLoading: boolean;
  error: string | null;
}

interface NetworkState {
  nodes: string[];
  isLoading: boolean;
  error: string | null;
}

// Hook that returns permission utility functions
export function usePermissionUtils(user: User | null): PermissionUtils {
  const canEdit = useCallback(async (targetNodeId: string): Promise<boolean> => {
    if (!user) return false;
    return canEditNode(targetNodeId, user.id);
  }, [user]);

  const get1DegreeNetwork = useCallback(async (): Promise<string[]> => {
    if (!user) return [];
    return get1DegreeNodes(user.id);
  }, [user]);

  const getRelationship = useCallback(async (targetNodeId: string): Promise<{
    type: RelationshipType;
    label: string;
  }> => {
    if (!user) return { type: 'unrelated', label: 'Not related' };
    return getNodeRelationship(user.id, targetNodeId);
  }, [user]);

  const isAdmin = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    try {
      const { data, error } = await supabase.rpc('is_admin');
      if (error) {
        console.error('Error checking admin status:', error);
        return false;
      }
      return !!data;
    } catch (err) {
      console.error('Error in isAdmin:', err);
      return false;
    }
  }, [user]);

  return {
    canEdit,
    get1DegreeNetwork,
    getRelationship,
    isAdmin,
  };
}

// Hook for tracking permission status for a specific node
export function usePermissionStatus(
  targetNodeId: string | null,
  user: User | null
): PermissionState {
  const [state, setState] = useState<PermissionState>({
    canEdit: false,
    isLoading: false,
    error: null,
  });

  useEffect(() => {
    if (!targetNodeId || !user) {
      setState({ canEdit: false, isLoading: false, error: null });
      return;
    }

    const checkPermission = async () => {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      try {
        const result = await canEditNode(targetNodeId, user.id);
        setState({
          canEdit: result,
          isLoading: false,
          error: null,
        });
      } catch (err) {
        console.error('Error checking permission:', err);
        setState({
          canEdit: false,
          isLoading: false,
          error: err instanceof Error ? err.message : 'Failed to check permission',
        });
      }
    };

    checkPermission();
  }, [targetNodeId, user]);

  return state;
}

// Hook for getting the full 1-degree network
export function use1DegreeNetwork(user: User | null): NetworkState {
  const [state, setState] = useState<NetworkState>({
    nodes: [],
    isLoading: false,
    error: null,
  });

  useEffect(() => {
    if (!user) {
      setState({ nodes: [], isLoading: false, error: null });
      return;
    }

    const loadNetwork = async () => {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      try {
        const nodes = await get1DegreeNodes(user.id);
        setState({
          nodes,
          isLoading: false,
          error: null,
        });
      } catch (err) {
        console.error('Error loading 1-degree network:', err);
        setState({
          nodes: [],
          isLoading: false,
          error: err instanceof Error ? err.message : 'Failed to load network',
        });
      }
    };

    loadNetwork();
  }, [user]);

  return state;
}

// Hook for getting current user's bound node info
export function useUserBoundNode() {
  const [state, setState] = useState<{
    nodeId: string | null;
    isLoading: boolean;
    error: string | null;
  }>({
    nodeId: null,
    isLoading: false,
    error: null,
  });

  useEffect(() => {
    const loadBoundNode = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setState({ nodeId: null, isLoading: false, error: null });
          return;
        }

        setState(prev => ({ ...prev, isLoading: true }));
        
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/users?id=eq.${user.id}&select=node_id`,
          {
            headers: {
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error('Failed to load user profile');
        }

        const data = await response.json();
        const nodeId = data[0]?.node_id || null;
        
        setState({
          nodeId,
          isLoading: false,
          error: null,
        });
      } catch (err) {
        console.error('Error loading bound node:', err);
        setState({
          nodeId: null,
          isLoading: false,
          error: err instanceof Error ? err.message : 'Failed to load bound node',
        });
      }
    };

    loadBoundNode();
  }, []);

  return state;
}
