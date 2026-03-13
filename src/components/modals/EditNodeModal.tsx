import React, { useState, useEffect } from 'react';
import Button from '@mui/material/Button';
import { useAuth } from '../../contexts/AuthContext';
import { FamilyNode } from '../../types/graph';

const MAX_NAME_LENGTH = 200;
const MAX_CLUSTER_LENGTH = 100;

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
  const [maternalFamilyCluster, setMaternalFamilyCluster] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<FamilyNode[]>([]);

  // Reset state when modal opens with target node data
  useEffect(() => {
    if (isOpen && targetNode) {
      setName(targetNode.name);
      setFamilyCluster(targetNode.familyCluster || '');
      setMaternalFamilyCluster(targetNode.maternalFamilyCluster || '');
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
    const sanitizedName = name.trim().slice(0, MAX_NAME_LENGTH);
    if (!user || !sanitizedName) return;

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const authToken = session?.access_token || supabaseKey;

      const updateData: {
        name: string;
        paternal_family_cluster?: string | null;
        maternal_family_cluster?: string | null;
      } = {
        name: sanitizedName,
      };

      // Only include clusters if admin (regular users shouldn't change clusters)
      const sanitizedPaternal = familyCluster.trim().slice(0, MAX_CLUSTER_LENGTH);
      const sanitizedMaternal = maternalFamilyCluster.trim().slice(0, MAX_CLUSTER_LENGTH);
      if (isAdmin) {
        updateData.paternal_family_cluster = sanitizedPaternal || null;
        updateData.maternal_family_cluster = sanitizedMaternal || null;
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

      setSuccessMessage('Changes saved successfully!');
      onSuccess();

      // Close modal after a brief delay so user sees success message
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      console.error('[EditNodeModal] Error:', err);
      setError('Something went wrong. Please try again.');
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
              onChange={(e) => setName(e.target.value.slice(0, MAX_NAME_LENGTH))}
              placeholder="e.g. John - Smith"
              style={inputStyle}
              maxLength={MAX_NAME_LENGTH}
              required
              disabled={isSubmitting}
            />
            <p style={{ margin: '5px 0 0 0', fontSize: '0.8rem', color: '#888' }}>
              Format: First Name - Family Name
            </p>
          </div>

          {/* Admin-only: Family Cluster fields */}
          {isAdmin && (
            <>
              <div style={fieldStyle}>
                <label style={labelStyle}>
                  Paternal Family Cluster (Admin Only)
                </label>
                <input
                  type="text"
                  value={familyCluster}
                  onChange={(e) => setFamilyCluster(e.target.value.slice(0, MAX_CLUSTER_LENGTH))}
                  placeholder="e.g. Badran, Kutob, etc."
                  style={inputStyle}
                  maxLength={MAX_CLUSTER_LENGTH}
                  disabled={isSubmitting}
                />
                <p style={{ margin: '5px 0 0 0', fontSize: '0.8rem', color: '#888' }}>
                  Primary family name (3D positioning, display)
                </p>
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>
                  Maternal Family Cluster (Admin Only)
                </label>
                <input
                  type="text"
                  value={maternalFamilyCluster}
                  onChange={(e) => setMaternalFamilyCluster(e.target.value.slice(0, MAX_CLUSTER_LENGTH))}
                  placeholder="e.g. mother's family name"
                  style={inputStyle}
                  maxLength={MAX_CLUSTER_LENGTH}
                  disabled={isSubmitting}
                />
                <p style={{ margin: '5px 0 0 0', fontSize: '0.8rem', color: '#888' }}>
                  For children to appear on mother&apos;s family tree in 2D
                </p>
              </div>
            </>
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
            <Button variant="outlined" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={isSubmitting || !name.trim()}
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
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

