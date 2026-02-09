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
  const { user, session, signInWithGoogle, refreshUserProfile } = useAuth();
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

    let cancelled = false;

    const validateInvite = async () => {
      console.log('[InvitePage] Starting validation for token:', token);
      
      try {
        // Bypass Supabase client (websocket hangs) - use raw fetch to REST API
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        
        console.log('[InvitePage] Calling RPC via fetch...');
        const fetchStart = Date.now();
        
        const response = await fetch(
          `${supabaseUrl}/rest/v1/rpc/get_invite_by_token`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({ invite_token: token }),
          }
        );
        
        const fetchEnd = Date.now();
        console.log('[InvitePage] REST API completed in', fetchEnd - fetchStart, 'ms, status:', response.status);
        
        if (cancelled) return;

        if (!response.ok) {
          console.error('[InvitePage] HTTP error:', response.status, response.statusText);
          const errorText = await response.text();
          console.error('[InvitePage] Error body:', errorText);
          setInviteStatus('not_found');
          return;
        }
        
        const data = await response.json();
        console.log('[InvitePage] Got data:', data);

        // RPC returns null when no row found
        if (!data || typeof data !== 'object') {
          console.log('[InvitePage] No data, setting not_found');
          setInviteStatus('not_found');
          return;
        }

        // Check if already claimed
        if (data.claimed_by_user_id) {
          console.log('[InvitePage] Already claimed');
          setInviteStatus('claimed');
          setInviteData(data);
          return;
        }

        // Check if expired
        const expiresAt = new Date(data.expires_at);
        if (expiresAt < new Date()) {
          console.log('[InvitePage] Expired');
          setInviteStatus('expired');
          setInviteData(data);
          return;
        }

        console.log('[InvitePage] Valid! Setting status...');
        setInviteStatus('valid');
        setInviteData(data);
      } catch (err) {
        if (cancelled) return;
        console.error('[InvitePage] Exception:', err);
        setInviteStatus('error');
        setErrorMessage('Failed to validate invite');
      }
    };

    validateInvite();

    return () => {
      cancelled = true;
    };
  }, [token]);

  // Auto-claim when user logs in
  useEffect(() => {
    if (user && inviteStatus === 'valid' && inviteData) {
      claimInvite();
    }
  }, [user, inviteStatus, inviteData]);

  const claimInvite = async () => {
    if (!user || !inviteData || !token) return;

    console.log('[InvitePage] Claiming invite for user:', user.id);
    setInviteStatus('claiming');

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      // Use authenticated session token
      const authToken = session?.access_token || supabaseKey;
      
      // Call the secure RPC function that handles the entire claim flow atomically
      console.log('[InvitePage] Calling claim_invite_secure RPC...');
      const response = await fetch(
        `${supabaseUrl}/rest/v1/rpc/claim_invite_secure`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            invite_token: token,
            claiming_user_id: user.id,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[InvitePage] RPC call failed:', errorText);
        throw new Error('Failed to claim invite');
      }

      const result = await response.json();
      console.log('[InvitePage] RPC result:', result);

      // Check if the RPC returned an error
      if (!result.success) {
        console.error('[InvitePage] Claim failed:', result.error);
        setInviteStatus('error');
        
        // Map error codes to user-friendly messages
        switch (result.error) {
          case 'invalid_invite':
            setErrorMessage('This invite link is not valid.');
            break;
          case 'already_claimed':
            setInviteStatus('claimed');
            setErrorMessage('This invite has already been claimed.');
            break;
          case 'already_bound':
            setErrorMessage('You are already bound to a node in the family tree.');
            break;
          default:
            setErrorMessage(result.message || 'Failed to claim invite. Please try again.');
        }
        return;
      }

      // Success! Redirect with hard reload to ensure fresh auth context
      console.log('[InvitePage] Claim successful! Redirecting...');
      window.location.href = '/';
      
    } catch (error) {
      console.error('[InvitePage] Error claiming invite:', error);
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
                {inviteData?.node_name ?? 'a family member'}
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
