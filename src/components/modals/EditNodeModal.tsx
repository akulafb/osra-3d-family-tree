import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { FamilyNode } from '../../types/graph';

interface EditNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetNode: FamilyNode;
  onSuccess: () => void;
  existingNodes: FamilyNode[];
}

export default function EditNodeModal({
  isOpen,
  onClose,
  targetNode,
  onSuccess,
  existingNodes,
}: EditNodeModalProps) {
  const { user, isAdmin, session } = useAuth();
  const [name, setName] = useState('');
  const [familyCluster, setFamilyCluster] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<FamilyNode[]>([]);

  // Reset state when modal opens with target node data
  useEffect(() => {
    if (isOpen && targetNode) {
      setName(targetNode.name);
      setFamilyCluster(targetNode.familyCluster || '');
      setError(null);
      setSuccessMessage(null);
      setDuplicateWarning([]);
    }
  }, [isOpen, targetNode]);

  // Check for duplicates when name changes
  useEffect(() => {
    if (name.trim().length > 2 && name.trim() !== targetNode.name) {
      const matches = existingNodes.filter(
        (node) =>
          node.name.toLowerCase().includes(name.toLowerCase()) &&
          node.id !== targetNode.id
      );
      setDuplicateWarning(matches);
    } else {
      setDuplicateWarning([]);
    }
  }, [name, existingNodes, targetNode.id, targetNode.name]);

  // Clear success message after 3 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) return;

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const authToken = session?.access_token || supabaseKey;

      console.log(`[EditNodeModal] Updating node ${targetNode.id}...`);

      const updateData: { name: string; family_cluster?: string | null } = {
        name: name.trim(),
      };

      // Only include family_cluster if admin (regular users shouldn't change clusters)
      if (isAdmin && familyCluster.trim()) {
        updateData.family_cluster = familyCluster.trim();
      }

      const response = await fetch(
        `${supabaseUrl}/rest/v1/nodes?id=eq.${targetNode.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            apikey: supabaseKey,
            Authorization: `Bearer ${authToken}`,
            Prefer: 'return=representation',
          },
          body: JSON.stringify(updateData),
        }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || `Update failed with status ${response.status}`);
      }

      const result = await response.json();
      console.log('[EditNodeModal] Update result:', result);

      setSuccessMessage('Changes saved successfully!');
      onSuccess();

      // Close modal after a brief delay so user sees success message
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      console.error('[EditNodeModal] Error:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={modalOverlayStyle}>
      <div style={modalContentStyle}>
        <h2 style={{ marginTop: 0, color: 'white' }}>Edit {targetNode.name}</h2>

        <form onSubmit={handleSubmit}>
          <div style={fieldStyle}>
            <label style={labelStyle}>Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. John - Smith"
              style={inputStyle}
              required
              disabled={isSubmitting}
            />
            <p style={{ margin: '5px 0 0 0', fontSize: '0.8rem', color: '#888' }}>
              Format: First Name - Family Name
            </p>
          </div>

          {/* Admin-only: Family Cluster field */}
          {isAdmin && (
            <div style={fieldStyle}>
              <label style={labelStyle}>
                Family Cluster (Admin Only)
              </label>
              <input
                type="text"
                value={familyCluster}
                onChange={(e) => setFamilyCluster(e.target.value)}
                placeholder="e.g. Badran, Kutob, etc."
                style={inputStyle}
                disabled={isSubmitting}
              />
              <p style={{ margin: '5px 0 0 0', fontSize: '0.8rem', color: '#888' }}>
                Controls which family cluster this person belongs to (3D positioning)
              </p>
            </div>
          )}

          {/* Show current cluster for non-admins */}
          {!isAdmin && targetNode.familyCluster && (
            <div style={infoBoxStyle}>
              <strong>Family Cluster:</strong> {targetNode.familyCluster}
            </div>
          )}

          {duplicateWarning.length > 0 && (
            <div style={warningStyle}>
              ⚠️ <strong>Similar names found:</strong>
              <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
                {duplicateWarning.map((m) => (
                  <li key={m.id}>{m.name}</li>
                ))}
              </ul>
              <p style={{ fontSize: '0.8em', margin: 0 }}>
                Please ensure you're not creating a duplicate.
              </p>
            </div>
          )}

          {successMessage && <div style={successStyle}>{successMessage}</div>}
          {error && <div style={errorStyle}>{error}</div>}

          <div style={actionsStyle}>
            <button
              type="button"
              onClick={onClose}
              style={cancelButtonStyle}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                ...submitButtonStyle,
                opacity: isSubmitting || !name.trim() ? 0.6 : 1,
                cursor: isSubmitting || !name.trim() ? 'not-allowed' : 'pointer',
              }}
              disabled={isSubmitting || !name.trim()}
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Styles
const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.85)',
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
  boxShadow: '0 10px 40px rgba(0,0,0,0.8)',
  border: '1px solid #333',
};

const fieldStyle: React.CSSProperties = {
  marginBottom: '20px',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '8px',
  fontSize: '0.9rem',
  color: '#aaa',
  fontWeight: 'bold',
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

const infoBoxStyle: React.CSSProperties = {
  backgroundColor: 'rgba(59, 130, 246, 0.1)',
  border: '1px solid #3b82f6',
  color: '#60a5fa',
  padding: '12px',
  borderRadius: '6px',
  marginBottom: '20px',
  fontSize: '0.9rem',
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

const successStyle: React.CSSProperties = {
  backgroundColor: 'rgba(16, 185, 129, 0.15)',
  border: '1px solid #10b981',
  color: '#10b981',
  padding: '12px',
  borderRadius: '6px',
  marginBottom: '20px',
  fontSize: '0.9rem',
};

const errorStyle: React.CSSProperties = {
  backgroundColor: 'rgba(239, 68, 68, 0.15)',
  border: '1px solid #ef4444',
  color: '#ef4444',
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
  paddingTop: '15px',
  borderTop: '1px solid #333',
};

const cancelButtonStyle: React.CSSProperties = {
  padding: '10px 20px',
  borderRadius: '6px',
  border: '1px solid #444',
  backgroundColor: 'transparent',
  color: '#aaa',
  cursor: 'pointer',
  fontWeight: 'bold',
};

const submitButtonStyle: React.CSSProperties = {
  padding: '10px 25px',
  borderRadius: '6px',
  border: 'none',
  backgroundColor: '#667eea',
  color: 'white',
  cursor: 'pointer',
  fontWeight: 'bold',
};
