import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

type InviteStatus = 
  | 'loading' 
  | 'valid' 
  | 'expired' 
  | 'claimed' 
  | 'not_found' 
  | 'claiming' 
  | 'error';

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const { user, signInWithGoogle, refreshUserProfile } = useAuth();
  const navigate = useNavigate();
  
  const [inviteStatus, setInviteStatus] = useState<InviteStatus>('loading');
  const [inviteData, setInviteData] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Validate the invite
  useEffect(() => {
    if (!token) {
      setInviteStatus('not_found');
      return;
    }

    const validateInvite = async () => {
      try {
        const { data, error } = await supabase
          .from('node_invites')
          .select('*, nodes(name)')
          .eq('token', token)
          .single();

        if (error || !data) {
          setInviteStatus('not_found');
          return;
        }

        // Check if already claimed
        if (data.claimed_by_user_id) {
          setInviteStatus('claimed');
          return;
        }

        // Check if expired
        const expiresAt = new Date(data.expires_at);
        if (expiresAt < new Date()) {
          setInviteStatus('expired');
          setInviteData(data);
          return;
        }

        setInviteStatus('valid');
        setInviteData(data);
      } catch (error) {
        console.error('Error validating invite:', error);
        setInviteStatus('error');
        setErrorMessage('Failed to validate invite');
      }
    };

    validateInvite();
  }, [token]);

  // Auto-claim when user logs in
  useEffect(() => {
    if (user && inviteStatus === 'valid' && inviteData) {
      claimInvite();
    }
  }, [user, inviteStatus, inviteData]);

  const claimInvite = async () => {
    if (!user || !inviteData) return;

    setInviteStatus('claiming');

    try {
      // First, check if user already has a node binding
      const { data: existingUser } = await supabase
        .from('users')
        .select('node_id')
        .eq('id', user.id)
        .single();

      if (existingUser?.node_id) {
        setInviteStatus('error');
        setErrorMessage('You are already bound to a node in the family tree.');
        return;
      }

      // Update the invite to mark as claimed
      const { error: inviteError } = await supabase
        .from('node_invites')
        .update({ claimed_by_user_id: user.id })
        .eq('token', token);

      if (inviteError) throw inviteError;

      // Create or update user profile to bind to node
      const { error: userError } = await supabase
        .from('users')
        .upsert({
          id: user.id,
          node_id: inviteData.node_id,
          role: 'user',
        });

      if (userError) throw userError;

      // Refresh the user profile in auth context
      await refreshUserProfile();

      // Redirect to home
      navigate('/');
    } catch (error) {
      console.error('Error claiming invite:', error);
      setInviteStatus('error');
      setErrorMessage('Failed to claim invite. Please try again.');
    }
  };

  const renderContent = () => {
    switch (inviteStatus) {
      case 'loading':
        return (
          <div>
            <h2>Validating invite...</h2>
          </div>
        );

      case 'valid':
        if (!user) {
          return (
            <div style={{ textAlign: 'center' }}>
              <h1 style={{ fontSize: '2.5rem', marginBottom: '20px' }}>
                You're Invited!
              </h1>
              <p style={{ fontSize: '1.2rem', marginBottom: '10px' }}>
                You've been invited to join the family tree as:
              </p>
              <p style={{ 
                fontSize: '1.8rem', 
                fontWeight: 'bold', 
                color: '#667eea',
                marginBottom: '30px'
              }}>
                {inviteData?.nodes?.name}
              </p>
              <button
                onClick={signInWithGoogle}
                style={{
                  padding: '15px 40px',
                  fontSize: '1.1rem',
                  background: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  color: '#667eea',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}
              >
                Sign in with Google to Accept
              </button>
            </div>
          );
        }
        return null; // Will auto-claim when user is present

      case 'claiming':
        return (
          <div>
            <h2>Claiming your spot in the family tree...</h2>
          </div>
        );

      case 'expired':
        return (
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '2.5rem', marginBottom: '20px', color: '#f59e0b' }}>
              Invite Expired
            </h1>
            <p style={{ fontSize: '1.2rem', marginBottom: '30px' }}>
              This invite link has expired. Please contact the person who sent it to request a new one.
            </p>
          </div>
        );

      case 'claimed':
        return (
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '2.5rem', marginBottom: '20px', color: '#10b981' }}>
              Already Claimed
            </h1>
            <p style={{ fontSize: '1.2rem', marginBottom: '30px' }}>
              This invite has already been claimed. If this was you, please sign in.
            </p>
            {!user && (
              <button
                onClick={signInWithGoogle}
                style={{
                  padding: '15px 40px',
                  fontSize: '1.1rem',
                  background: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  color: '#667eea',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}
              >
                Sign in with Google
              </button>
            )}
          </div>
        );

      case 'not_found':
        return (
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '2.5rem', marginBottom: '20px', color: '#ef4444' }}>
              Invalid Invite
            </h1>
            <p style={{ fontSize: '1.2rem', marginBottom: '30px' }}>
              This invite link is not valid. Please check the URL and try again.
            </p>
          </div>
        );

      case 'error':
        return (
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '2.5rem', marginBottom: '20px', color: '#ef4444' }}>
              Error
            </h1>
            <p style={{ fontSize: '1.2rem', marginBottom: '30px' }}>
              {errorMessage || 'Something went wrong. Please try again.'}
            </p>
          </div>
        );
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      gap: '20px',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      padding: '20px'
    }}>
      {renderContent()}
    </div>
  );
}
