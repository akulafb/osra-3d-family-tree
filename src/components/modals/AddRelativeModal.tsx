import React, { useState, useEffect, useMemo, useSyncExternalStore } from 'react';
import Button from '@mui/material/Button';
import { useAuth } from '../../contexts/AuthContext';
import { FamilyNode } from '../../types/graph';
import { formatNodeDisplayName, nodeSearchHaystack } from '../../utils/nodeDisplayName';

interface AddRelativeModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetNode: FamilyNode;
  /** Called after a successful add/link; awaited before closing so the tree shows the real edge before the cyan preview is removed. */
  onSuccess: () => void | Promise<void>;
  existingNodes: FamilyNode[];
  /** Called when user selects/clears a connect-to-existing target (for tree preview). */
  onPendingConnectTargetChange?: (existingNodeId: string | null) => void;
}

type RelationshipType = 'parent' | 'child' | 'spouse' | 'sibling';

const MAX_NAME_LENGTH = 200;

function subscribePreviewNarrow(cb: () => void) {
  const mq = window.matchMedia('(max-width: 768px)');
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}

function getPreviewNarrowSnapshot() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
}

function getPreviewNarrowServer() {
  return false;
}

function sortDuplicateCandidates(trimmedName: string, candidates: FamilyNode[]): FamilyNode[] {
  const lower = trimmedName.toLowerCase();
  return [...candidates].sort((a, b) => {
    const ae = a.firstName.trim().toLowerCase() === lower ? 0 : 1;
    const be = b.firstName.trim().toLowerCase() === lower ? 0 : 1;
    if (ae !== be) return ae - be;
    return a.firstName.localeCompare(b.firstName);
  });
}

export default function AddRelativeModal({
  isOpen,
  onClose,
  targetNode,
  onSuccess,
  existingNodes,
  onPendingConnectTargetChange,
}: AddRelativeModalProps) {
  const { user, session } = useAuth();
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState<RelationshipType>('child');
  const [parentRole, setParentRole] = useState<'mother' | 'father' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedDifferentPerson, setConfirmedDifferentPerson] = useState(false);
  const [selectedExistingId, setSelectedExistingId] = useState<string | null>(null);

  const duplicateCandidates = useMemo(() => {
    const t = name.trim();
    if (t.length <= 2) return [];
    const matches = existingNodes.filter(
      (node) =>
        node.id !== targetNode.id &&
        nodeSearchHaystack(node).toLowerCase().includes(t.toLowerCase())
    );
    return sortDuplicateCandidates(t, matches);
  }, [name, existingNodes, targetNode.id]);

  const hasDuplicateConflict = duplicateCandidates.length > 0;
  const isPreviewConnectMode = Boolean(selectedExistingId);
  const previewNarrow = useSyncExternalStore(
    subscribePreviewNarrow,
    getPreviewNarrowSnapshot,
    getPreviewNarrowServer
  );

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setName('');
      setRelationship('child');
      setParentRole(null);
      setError(null);
      setConfirmedDifferentPerson(false);
      setSelectedExistingId(null);
      onPendingConnectTargetChange?.(null);
    }
  }, [isOpen, onPendingConnectTargetChange]);

  useEffect(() => {
    if (!isOpen) return;
    onPendingConnectTargetChange?.(selectedExistingId);
  }, [isOpen, selectedExistingId, onPendingConnectTargetChange]);

  useEffect(() => {
    if (!isOpen) return;
    setConfirmedDifferentPerson(false);
    setSelectedExistingId(null);
  }, [name, relationship, parentRole, isOpen]);

  const callLinkExisting = async (existingId: string) => {
    if (!user) return;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const authToken = session?.access_token || supabaseKey;
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/link_existing_relative_secure`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseKey,
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        existing_node_id: existingId,
        rel_type: relationship,
        target_node_id: targetNode.id,
        creator_id: user.id,
        ...(relationship === 'child' && parentRole && { p_parent_role: parentRole }),
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || `RPC failed with status ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || 'Failed to link relative');
    }
  };

  const callCreateNew = async (sanitizedName: string) => {
    if (!user) return;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const authToken = session?.access_token || supabaseKey;
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/create_relative_secure`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseKey,
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        new_first_name: sanitizedName,
        rel_type: relationship,
        target_node_id: targetNode.id,
        creator_id: user.id,
        ...(relationship === 'child' && parentRole && { p_parent_role: parentRole }),
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || `RPC failed with status ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || 'Failed to create relative');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sanitizedName = name.trim().slice(0, MAX_NAME_LENGTH);
    if (!user || !sanitizedName) return;

    if (hasDuplicateConflict && !confirmedDifferentPerson && !selectedExistingId) {
      setError('Choose an existing person to connect to, or confirm this is a different person.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (selectedExistingId) {
        await callLinkExisting(selectedExistingId);
      } else {
        await callCreateNew(sanitizedName);
      }
      await Promise.resolve(onSuccess());
      onClose();
    } catch (err) {
      console.error('[AddRelativeModal] Error:', err);
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectExisting = (id: string) => {
    setSelectedExistingId(id);
    setConfirmedDifferentPerson(false);
  };

  const handleConfirmDifferentPerson = () => {
    setConfirmedDifferentPerson(true);
    setSelectedExistingId(null);
  };

  if (!isOpen) return null;

  const overlayStyle: React.CSSProperties = isPreviewConnectMode
    ? {
        ...modalOverlayStyle,
        backgroundColor: 'transparent',
        pointerEvents: 'none',
        justifyContent: previewNarrow ? 'flex-end' : 'flex-end',
        alignItems: previewNarrow ? 'stretch' : 'center',
        flexDirection: previewNarrow ? 'column' : 'row',
      }
    : modalOverlayStyle;

  const panelStyle: React.CSSProperties = isPreviewConnectMode
    ? {
        ...modalContentStyle,
        pointerEvents: 'auto',
        maxHeight: previewNarrow ? 'min(44vh, 420px)' : 'min(85vh, 900px)',
        overflowY: 'auto',
        alignSelf: previewNarrow ? 'stretch' : 'center',
        margin: previewNarrow ? '0' : '16px',
        marginLeft: previewNarrow ? '0' : 'auto',
        marginRight: previewNarrow ? '0' : '16px',
        marginTop: previewNarrow ? 'auto' : undefined,
        marginBottom: previewNarrow ? '0' : undefined,
        maxWidth: previewNarrow ? '100%' : 'min(420px, 92vw)',
        width: previewNarrow ? '100%' : undefined,
        borderRadius: previewNarrow ? '12px 12px 0 0' : '12px',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.55)',
      }
    : modalContentStyle;

  const primaryDisabled =
    isSubmitting ||
    !name.trim() ||
    (hasDuplicateConflict && !confirmedDifferentPerson && !selectedExistingId);

  const primaryLabel = isSubmitting
    ? 'Working…'
    : selectedExistingId
      ? 'Connect to tree'
      : 'Add to tree';

  return (
    <div style={overlayStyle}>
      <div style={panelStyle}>
        {isPreviewConnectMode && (
          <p style={{ margin: '0 0 12px 0', fontSize: '0.85rem', color: '#7dd3fc' }}>
            Preview: cyan dashed line shows the link that will be created. Pan or rotate the tree if needed.
          </p>
        )}
        <h2 style={{ marginTop: 0 }}>Add relative to {formatNodeDisplayName(targetNode)}</h2>

        <form onSubmit={handleSubmit}>
          <div style={fieldStyle}>
            <label style={labelStyle}>First name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, MAX_NAME_LENGTH))}
              placeholder="Given name only; family comes from the tree"
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
              <option value="child">Add as child</option>
              <option value="parent">Add as parent</option>
              <option value="spouse">Add as spouse</option>
              <option value="sibling">Add as sibling</option>
            </select>
          </div>

          {relationship === 'child' && (
            <div style={fieldStyle}>
              <label style={labelStyle}>I am the…</label>
              <select
                value={parentRole ?? ''}
                onChange={(e) =>
                  setParentRole(e.target.value ? (e.target.value as 'mother' | 'father') : null)
                }
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

          {duplicateCandidates.length > 0 && (
            <div style={warningStyle}>
              <strong>Possible matches already on the tree</strong>
              <p style={{ fontSize: '0.85rem', margin: '8px 0', color: '#ddd' }}>
                Select someone to connect with the relationship above, or confirm you are adding a
                different person.
              </p>
              <ul style={{ margin: '8px 0', paddingLeft: '0', listStyle: 'none' }}>
                {duplicateCandidates.map((m) => (
                  <li key={m.id} style={{ marginBottom: '8px' }}>
                    <button
                      type="button"
                      onClick={() => selectExisting(m.id)}
                      style={{
                        ...matchRowStyle,
                        borderColor:
                          selectedExistingId === m.id ? '#22d3ee' : '#555',
                        backgroundColor:
                          selectedExistingId === m.id ? 'rgba(34, 211, 238, 0.12)' : '#1a1a1a',
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{formatNodeDisplayName(m)}</span>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          color: '#666',
                          fontFamily: 'monospace',
                          display: 'block',
                          wordBreak: 'break-all',
                        }}
                      >
                        {m.id}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '12px' }}>
                <input
                  type="checkbox"
                  checked={confirmedDifferentPerson}
                  onChange={(e) => {
                    if (e.target.checked) {
                      handleConfirmDifferentPerson();
                    } else {
                      setConfirmedDifferentPerson(false);
                    }
                  }}
                />
                <span style={{ fontSize: '0.9rem' }}>No, I am adding a totally different person</span>
              </label>
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
              disabled={primaryDisabled}
            >
              {primaryLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
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
  backgroundColor: 'rgba(255, 165, 0, 0.08)',
  border: '1px solid orange',
  color: '#ffcc00',
  padding: '12px',
  borderRadius: '6px',
  marginBottom: '20px',
  fontSize: '0.9rem',
};

const matchRowStyle: React.CSSProperties = {
  width: '100%',
  textAlign: 'left',
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid #555',
  color: '#fff',
  cursor: 'pointer',
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
