import React, { useState, useEffect } from 'react';
import Button from '@mui/material/Button';
import { useAuth } from '../../contexts/AuthContext';
import { FamilyNode } from '../../types/graph';

interface AddRelativeModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetNode: FamilyNode;
  onSuccess: () => void;
  existingNodes: FamilyNode[];
}

type RelationshipType = 'parent' | 'child' | 'spouse' | 'sibling';

const MAX_NAME_LENGTH = 200;

export default function AddRelativeModal({
  isOpen,
  onClose,
  targetNode,
  onSuccess,
  existingNodes
}: AddRelativeModalProps) {
  const { user, session } = useAuth();
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState<RelationshipType>('child');
  const [parentRole, setParentRole] = useState<'mother' | 'father' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<FamilyNode[]>([]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setName('');
      setRelationship('child');
      setParentRole(null);
      setError(null);
      setDuplicateWarning([]);
    }
  }, [isOpen]);

  // Basic duplicate detection (exact or partial name match)
  useEffect(() => {
    if (name.trim().length > 2) {
      const matches = existingNodes.filter(node => 
        node.name.toLowerCase().includes(name.toLowerCase()) && 
        node.id !== targetNode.id
      );
      setDuplicateWarning(matches);
    } else {
      setDuplicateWarning([]);
    }
  }, [name, existingNodes, targetNode.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sanitizedName = name.trim().slice(0, MAX_NAME_LENGTH);
    if (!user || !sanitizedName) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const authToken = session?.access_token || supabaseKey;
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/create_relative_secure`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          new_node_name: sanitizedName,
          rel_type: relationship,
          target_node_id: targetNode.id,
          creator_id: user.id,
          ...(relationship === 'child' && parentRole && { p_parent_role: parentRole }),
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || `RPC failed with status ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || 'Failed to create relative');
      }
      onSuccess();
      onClose();
    } catch (err) {
      console.error('[AddRelativeModal] Error:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={modalOverlayStyle}>
      <div style={modalContentStyle}>
        <h2 style={{ marginTop: 0 }}>Add Relative to {targetNode.name}</h2>
        
        <form onSubmit={handleSubmit}>
          <div style={fieldStyle}>
            <label style={labelStyle}>Full Name</label>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value.slice(0, MAX_NAME_LENGTH))} 
              placeholder="e.g. John Doe"
              style={inputStyle}
              maxLength={MAX_NAME_LENGTH}
              required
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Relationship</label>
            <select 
              value={relationship} 
              onChange={(e) => {
                setRelationship(e.target.value as RelationshipType);
                if (e.target.value !== 'child') setParentRole(null);
              }}
              style={inputStyle}
            >
              <option value="child">Add as Child</option>
              <option value="parent">Add as Parent</option>
              <option value="spouse">Add as Spouse</option>
              <option value="sibling">Add as Sibling</option>
            </select>
          </div>

          {relationship === 'child' && (
            <div style={fieldStyle}>
              <label style={labelStyle}>Target is the...</label>
              <select
                value={parentRole ?? ''}
                onChange={(e) => setParentRole(e.target.value ? (e.target.value as 'mother' | 'father') : null)}
                style={inputStyle}
              >
                <option value="">— Select (optional) —</option>
                <option value="mother">Mother</option>
                <option value="father">Father</option>
              </select>
              <p style={{ margin: '5px 0 0 0', fontSize: '0.8rem', color: '#888' }}>
                Helps show children on both parents&apos; family trees
              </p>
            </div>
          )}

          {duplicateWarning.length > 0 && (
            <div style={warningStyle}>
              ⚠️ <strong>Possible matches found:</strong>
              <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
                {duplicateWarning.map(m => <li key={m.id}>{m.name}</li>)}
              </ul>
              <p style={{ fontSize: '0.8em', margin: 0 }}>
                Please double check if they are already in the tree.
              </p>
            </div>
          )}

          {error && <div style={errorStyle}>{error}</div>}

          <div style={actionsStyle}>
            <Button variant="outlined" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={isSubmitting || !name.trim()}
            >
              {isSubmitting ? 'Adding...' : 'Add to Tree'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Styles
const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.75)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 2000,
};

const modalContentStyle: React.CSSProperties = {
  backgroundColor: '#2a2a2a',
  color: 'white',
  padding: '30px',
  borderRadius: '12px',
  width: '100%',
  maxWidth: '450px',
  boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
};

const fieldStyle: React.CSSProperties = {
  marginBottom: '20px',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '8px',
  fontSize: '0.9rem',
  color: '#aaa',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px',
  borderRadius: '6px',
  border: '1px solid #444',
  backgroundColor: '#1a1a1a',
  color: 'white',
  fontSize: '1rem',
  boxSizing: 'border-box',
};

const warningStyle: React.CSSProperties = {
  backgroundColor: 'rgba(255, 165, 0, 0.1)',
  border: '1px solid orange',
  color: '#ffcc00',
  padding: '12px',
  borderRadius: '6px',
  marginBottom: '20px',
  fontSize: '0.9rem',
};

const errorStyle: React.CSSProperties = {
  backgroundColor: 'rgba(255, 0, 0, 0.1)',
  border: '1px solid #ff4444',
  color: '#ff4444',
  padding: '12px',
  borderRadius: '6px',
  marginBottom: '20px',
  fontSize: '0.9rem',
};

const actionsStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '12px',
  marginTop: '30px',
};

