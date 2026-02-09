import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { FamilyNode } from '../../types/graph';

interface ManageInvitesModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetNode: FamilyNode;
  onSuccess: () => void;
}

interface Invite {
  id: string;
  token: string;
  expires_at: string;
  claimed_by_user_id: string | null;
  created_at: string;
  is_expired: boolean;
}

type InviteStatus = 'all' | 'active' | 'claimed' | 'expired';

export default function ManageInvitesModal({
  isOpen,
  onClose,
  targetNode,
  onSuccess,
}: ManageInvitesModalProps) {
  const { user, isAdmin, session } = useAuth();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<InviteStatus>('all');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Fetch invites when modal opens
  useEffect(() => {
    if (isOpen && targetNode) {
      fetchInvites();
    }
  }, [isOpen, targetNode]);

  // Clear success message after 3 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Clear copied token highlight after 2 seconds
  useEffect(() => {
    if (copiedToken) {
      const timer = setTimeout(() => setCopiedToken(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [copiedToken]);

  const fetchInvites = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const authToken = session?.access_token || supabaseKey;

      const response = await fetch(
        `${supabaseUrl}/rest/v1/node_invites?node_id=eq.${targetNode.id}&order=created_at.desc`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${authToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch invites');
      }

      const data = await response.json();
      // Add computed is_expired field
      const now = new Date();
      const processedData = data.map((invite: Invite) => ({
        ...invite,
        is_expired: new Date(invite.expires_at) < now,
      }));
      setInvites(processedData);
    } catch (err) {
      console.error('[ManageInvitesModal] Error fetching invites:', err);
      setError(err instanceof Error ? err.message : 'Failed to load invites');
    } finally {
      setIsLoading(false);
    }
  };

  const createInvite = async () => {
    if (!user) return;

    setIsCreating(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const authToken = session?.access_token || supabaseKey;

      // Generate a secure random token
      const token = generateSecureToken();
      // Set expiration to 7 days from now
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const response = await fetch(`${supabaseUrl}/rest/v1/node_invites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${authToken}`,
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({
          node_id: targetNode.id,
          token: token,
          expires_at: expiresAt.toISOString(),
          created_by_user_id: user.id,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to create invite');
      }

      await fetchInvites(); // Refresh the list
      setSuccessMessage('Invite created successfully!');
      onSuccess();
    } catch (err) {
      console.error('[ManageInvitesModal] Error creating invite:', err);
      setError(err instanceof Error ? err.message : 'Failed to create invite');
    } finally {
      setIsCreating(false);
    }
  };

  const revokeInvite = async (inviteId: string) => {
    if (!user) return;

    setError(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const authToken = session?.access_token || supabaseKey;

      // Instead of deleting, we'll set the expiration to now (effectively revoking)
      const response = await fetch(
        `${supabaseUrl}/rest/v1/node_invites?id=eq.${inviteId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            expires_at: new Date().toISOString(),
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to revoke invite');
      }

      await fetchInvites(); // Refresh the list
      setSuccessMessage('Invite revoked');
    } catch (err) {
      console.error('[ManageInvitesModal] Error revoking invite:', err);
      setError(err instanceof Error ? err.message : 'Failed to revoke invite');
    }
  };

  const copyInviteLink = (token: string) => {
    const inviteUrl = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedToken(token);
  };

  const generateSecureToken = (): string => {
    // Generate a URL-safe token: timestamp + random chars
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 15);
    return `invite-${timestamp}-${random}`;
  };

  const getInviteStatus = (invite: Invite): string => {
    if (invite.claimed_by_user_id) return 'claimed';
    if (invite.is_expired) return 'expired';
    return 'active';
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'claimed':
        return { color: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)' }; // Green
      case 'expired':
        return { color: '#6b7280', backgroundColor: 'rgba(107, 114, 128, 0.1)' }; // Gray
      case 'active':
        return { color: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.1)' }; // Amber
      default:
        return { color: '#9ca3af', backgroundColor: 'rgba(156, 163, 175, 0.1)' };
    }
  };

  const filteredInvites = invites.filter((invite) => {
    if (filter === 'all') return true;
    return getInviteStatus(invite) === filter;
  });

  // Count invites by status
  const counts = {
    all: invites.length,
    active: invites.filter((i) => getInviteStatus(i) === 'active').length,
    claimed: invites.filter((i) => getInviteStatus(i) === 'claimed').length,
    expired: invites.filter((i) => getInviteStatus(i) === 'expired').length,
  };

  if (!isOpen) return null;

  return (
    <div style={modalOverlayStyle}>
      <div style={modalContentStyle}>
        <h2 style={{ marginTop: 0, color: 'white' }}>
          Manage Invites for {targetNode.name}
        </h2>

        {/* Create New Invite Section */}
        <div style={createSectionStyle}>
          <h3 style={{ margin: '0 0 15px 0', color: '#aaa', fontSize: '1rem' }}>
            Create New Invite
          </h3>
          <button
            onClick={createInvite}
            disabled={isCreating}
            style={{
              ...createButtonStyle,
              opacity: isCreating ? 0.6 : 1,
              cursor: isCreating ? 'not-allowed' : 'pointer',
            }}
          >
            {isCreating ? 'Creating...' : '+ Create New Invite Link'}
          </button>
          <p style={{ margin: '10px 0 0 0', fontSize: '0.85rem', color: '#888', lineHeight: '1.5' }}>
            Creates a 7-day invite link for <strong>{targetNode.name}</strong>. Send this link to them (or their parent/guardian) so they can claim their node and access the family tree.
          </p>
        </div>

        {/* Status Messages */}
        {successMessage && (
          <div style={successStyle}>{successMessage}</div>
        )}
        {error && <div style={errorStyle}>{error}</div>}

        {/* Filter Tabs */}
        <div style={filterContainerStyle}>
          {(['all', 'active', 'claimed', 'expired'] as InviteStatus[]).map(
            (status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                style={{
                  ...filterTabStyle,
                  backgroundColor:
                    filter === status ? 'rgba(102, 126, 234, 0.3)' : 'transparent',
                  borderColor: filter === status ? '#667eea' : '#444',
                  color: filter === status ? '#667eea' : '#aaa',
                }}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)} ({counts[status]})
              </button>
            )
          )}
        </div>

        {/* Invites List */}
        <div style={listContainerStyle}>
          {isLoading ? (
            <div style={centeredTextStyle}>Loading invites...</div>
          ) : filteredInvites.length === 0 ? (
            <div style={centeredTextStyle}>
              No {filter !== 'all' ? filter : ''} invites found.
            </div>
          ) : (
            filteredInvites.map((invite) => {
              const status = getInviteStatus(invite);
              const statusStyle = getStatusStyle(status);
              const isCopied = copiedToken === invite.token;

              return (
                <div key={invite.id} style={inviteItemStyle}>
                  <div style={inviteHeaderStyle}>
                    <span
                      style={{
                        ...statusBadgeStyle,
                        color: statusStyle.color,
                        backgroundColor: statusStyle.backgroundColor,
                      }}
                    >
                      {status.toUpperCase()}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: '#888' }}>
                      {new Date(invite.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <div style={tokenContainerStyle}>
                    <code style={tokenStyle}>{invite.token}</code>
                    {status === 'active' && (
                      <button
                        onClick={() => copyInviteLink(invite.token)}
                        style={{
                          ...copyButtonStyle,
                          backgroundColor: isCopied ? '#10b981' : '#667eea',
                        }}
                      >
                        {isCopied ? 'Copied!' : 'Copy Link'}
                      </button>
                    )}
                  </div>

                  {status === 'active' && (
                    <div style={actionsContainerStyle}>
                      <button
                        onClick={() => revokeInvite(invite.id)}
                        style={revokeButtonStyle}
                      >
                        Revoke
                      </button>
                    </div>
                  )}

                  {invite.claimed_by_user_id && (
                    <div style={claimedInfoStyle}>
                      Claimed by user: {invite.claimed_by_user_id.substring(0, 8)}...
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Close Button */}
        <div style={actionsStyle}>
          <button onClick={onClose} style={closeButtonStyle}>
            Close
          </button>
        </div>
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
  backgroundColor: '#1a1a1a',
  color: 'white',
  padding: '30px',
  borderRadius: '12px',
  width: '100%',
  maxWidth: '550px',
  maxHeight: '80vh',
  overflow: 'auto',
  boxShadow: '0 10px 40px rgba(0,0,0,0.8)',
  border: '1px solid #333',
};

const createSectionStyle: React.CSSProperties = {
  backgroundColor: '#252525',
  padding: '20px',
  borderRadius: '8px',
  marginBottom: '20px',
  border: '1px solid #333',
};

const createButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px',
  backgroundColor: '#667eea',
  color: 'white',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  fontWeight: 'bold',
  fontSize: '1rem',
  transition: 'background-color 0.2s',
};

const successStyle: React.CSSProperties = {
  backgroundColor: 'rgba(16, 185, 129, 0.15)',
  border: '1px solid #10b981',
  color: '#10b981',
  padding: '12px',
  borderRadius: '6px',
  marginBottom: '15px',
  fontSize: '0.9rem',
};

const errorStyle: React.CSSProperties = {
  backgroundColor: 'rgba(239, 68, 68, 0.15)',
  border: '1px solid #ef4444',
  color: '#ef4444',
  padding: '12px',
  borderRadius: '6px',
  marginBottom: '15px',
  fontSize: '0.9rem',
};

const filterContainerStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  marginBottom: '15px',
  flexWrap: 'wrap',
};

const filterTabStyle: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: '20px',
  border: '1px solid #444',
  backgroundColor: 'transparent',
  color: '#aaa',
  cursor: 'pointer',
  fontSize: '0.85rem',
  fontWeight: 'bold',
  transition: 'all 0.2s',
};

const listContainerStyle: React.CSSProperties = {
  maxHeight: '300px',
  overflowY: 'auto',
  paddingRight: '5px',
};

const centeredTextStyle: React.CSSProperties = {
  textAlign: 'center',
  color: '#888',
  padding: '30px',
  fontStyle: 'italic',
};

const inviteItemStyle: React.CSSProperties = {
  backgroundColor: '#252525',
  border: '1px solid #333',
  borderRadius: '8px',
  padding: '15px',
  marginBottom: '10px',
};

const inviteHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '10px',
};

const statusBadgeStyle: React.CSSProperties = {
  padding: '4px 10px',
  borderRadius: '12px',
  fontSize: '0.75rem',
  fontWeight: 'bold',
  letterSpacing: '0.5px',
};

const tokenContainerStyle: React.CSSProperties = {
  display: 'flex',
  gap: '10px',
  alignItems: 'center',
  marginBottom: '10px',
};

const tokenStyle: React.CSSProperties = {
  flex: 1,
  fontFamily: 'monospace',
  fontSize: '0.85rem',
  backgroundColor: '#1a1a1a',
  padding: '8px 12px',
  borderRadius: '4px',
  color: '#aaa',
  wordBreak: 'break-all',
};

const copyButtonStyle: React.CSSProperties = {
  padding: '8px 16px',
  color: 'white',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  fontWeight: 'bold',
  fontSize: '0.85rem',
  whiteSpace: 'nowrap',
};

const actionsContainerStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  marginTop: '10px',
};

const revokeButtonStyle: React.CSSProperties = {
  padding: '6px 12px',
  backgroundColor: 'transparent',
  color: '#ef4444',
  border: '1px solid #ef4444',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '0.8rem',
  fontWeight: 'bold',
};

const claimedInfoStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  color: '#10b981',
  marginTop: '8px',
  fontStyle: 'italic',
};

const actionsStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  marginTop: '20px',
  paddingTop: '15px',
  borderTop: '1px solid #333',
};

const closeButtonStyle: React.CSSProperties = {
  padding: '10px 25px',
  backgroundColor: 'transparent',
  color: '#aaa',
  border: '1px solid #444',
  borderRadius: '6px',
  cursor: 'pointer',
  fontWeight: 'bold',
};
