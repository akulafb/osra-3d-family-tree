import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { canEditNode, get1DegreeNodes, getNodeRelationship } from '../lib/permissions';

interface NodeInfo {
  id: string;
  name: string;
  canEdit: boolean;
  relationship: string;
}

export function PermissionTest() {
  const { user, userProfile, isLoading: authLoading } = useAuth();
  const [nodes, setNodes] = useState<NodeInfo[]>([]);
  const [networkNodes, setNetworkNodes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || authLoading) return;

    const testPermissions = async () => {
      setIsLoading(true);
      setError(null);

      try {
        console.log('[PermissionTest] Testing permissions for user:', user.id);
        
        // Get all nodes
        const { data: nodesData, error: nodesError } = await supabase
          .from('nodes')
          .select('*');

        if (nodesError) throw nodesError;

        // Get user's bound node
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('node_id, role')
          .eq('id', user.id)
          .single();

        if (userError) throw userError;

        const userNodeId = (userData as any)?.node_id;
        const isAdmin = (userData as any)?.role === 'admin';

        console.log('[PermissionTest] User node ID:', userNodeId);
        console.log('[PermissionTest] Is admin:', isAdmin);

        // Test permissions for each node
        const nodeInfos: NodeInfo[] = [];
        for (const node of (nodesData || []) as any[]) {
          const canEdit = await canEditNode(node.id, user.id);
          const rel = await getNodeRelationship(user.id, node.id);
          
          nodeInfos.push({
            id: node.id,
            name: node.name,
            canEdit,
            relationship: rel.label,
          });
        }

        // Get 1-degree network
        const network = await get1DegreeNodes(user.id);
        
        console.log('[PermissionTest] 1-degree network:', network);
        console.log('[PermissionTest] Editable nodes:', nodeInfos.filter(n => n.canEdit).map(n => n.name));

        setNodes(nodeInfos);
        setNetworkNodes(network);
      } catch (err) {
        console.error('[PermissionTest] Error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    testPermissions();
  }, [user, authLoading]);

  if (authLoading || isLoading) {
    return (
      <div style={{ padding: '20px', color: 'white' }}>
        Testing permissions...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px', color: '#ff6b6b' }}>
        Error: {error}
      </div>
    );
  }

  const editableCount = nodes.filter(n => n.canEdit).length;
  const totalCount = nodes.length;

  return (
    <div style={{ 
      padding: '20px', 
      color: 'white',
      background: 'rgba(0,0,0,0.8)',
      borderRadius: '8px',
      maxWidth: '600px',
      margin: '20px auto'
    }}>
      <h2>🔐 Permission Test Results</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <strong>Your Bound Node:</strong> {userProfile?.node_id ? '✅ Bound' : '❌ Not bound'}
      </div>

      <div style={{ marginBottom: '20px' }}>
        <strong>1-Degree Network:</strong> {networkNodes.length} nodes
        <div style={{ fontSize: '0.9em', color: '#aaa', marginTop: '5px' }}>
          {networkNodes.join(', ')}
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <strong>Permission Summary:</strong> {editableCount} / {totalCount} nodes editable
      </div>

      <h3>All Nodes:</h3>
      <div style={{ maxHeight: '300px', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #444' }}>
              <th style={{ textAlign: 'left', padding: '8px' }}>Node</th>
              <th style={{ textAlign: 'left', padding: '8px' }}>Relationship</th>
              <th style={{ textAlign: 'left', padding: '8px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {(nodes as any[]).map((node: any) => (
              <tr 
                key={node.id} 
                style={{ 
                  borderBottom: '1px solid #333',
                  background: node.canEdit ? 'rgba(0,255,0,0.1)' : 'transparent'
                }}
              >
                <td style={{ padding: '8px' }}>{node.name}</td>
                <td style={{ padding: '8px', color: '#aaa' }}>{node.relationship}</td>
                <td style={{ padding: '8px' }}>
                  {node.canEdit ? '✅ Can Edit' : '🔒 Locked'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '20px', fontSize: '0.85em', color: '#888' }}>
        <p><strong>Expected behavior:</strong></p>
        <ul>
          <li>✅ You (and your 1-degree relatives: parents, children, siblings, spouse) should be editable</li>
          <li>🔒 Everyone else should be locked</li>
          <li>🎖️ If you're admin, everything should be editable</li>
        </ul>
      </div>
    </div>
  );
}
