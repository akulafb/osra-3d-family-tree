import { lazy, Suspense } from 'react';
import Button from '@mui/material/Button';
import { FamilyTree } from '../components/FamilyTree';
import { useAuth } from '../contexts/AuthContext';

const LandingPage = lazy(() => import('../landing/LandingPage'));

export default function HomePage() {
  const { user, isLoading, signInWithGoogle, signOut, isBound } = useAuth();

  // #region agent log
  fetch('http://127.0.0.1:7735/ingest/e2ae643e-1184-40a1-9f61-75bc5e06ec80',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9ceeb1'},body:JSON.stringify({sessionId:'9ceeb1',runId:'loading-stuck',hypothesisId:'L4',location:'HomePage.tsx:10',message:'HomePage render',data:{hasUser:!!user,isLoading,isBound},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          minHeight: '100vh',
          color: 'white',
          background: '#0a0a0a',
        }}
        aria-busy="true"
      >
        Loading <span style={{ fontFamily: 'cursive', fontWeight: 'bold' }}>Osra</span>...
      </div>
    );
  }

  // If not logged in, show the new landing page (lazy loaded)
  if (!user) {
    return (
      <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0a0a0a', color: '#fff' }}>Loading...</div>}>
        <LandingPage onSignIn={() => signInWithGoogle(window.location.origin)} />
      </Suspense>
    );
  }

  // If logged in but not bound to a node, show message
  if (!isBound) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        gap: '20px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <h1 style={{ color: 'white', fontSize: '2.5rem', marginBottom: '10px' }}>
          Welcome, {user.email}!
        </h1>
        <p style={{ color: 'white', fontSize: '1.2rem', textAlign: 'center', maxWidth: '600px' }}>
          You need an invite link to access the family tree. Please ask a family member to send you an invite.
        </p>
        <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.85rem', fontFamily: 'monospace' }}>
          Clerk ID: {user.id}{' '}
          <Button size="small" variant="outlined" sx={{ color: 'rgba(255,255,255,0.9)', borderColor: 'rgba(255,255,255,0.6)' }} onClick={() => navigator.clipboard.writeText(user.id)}>
            Copy
          </Button>
        </p>
        <Button variant="outlined" onClick={signOut} sx={{ border: '2px solid white', color: 'white', fontWeight: 'bold' }}>
          Sign Out
        </Button>
      </div>
    );
  }

  // Logged in and bound - show the Family Tree with 2D/3D toggle
  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      {/* Sign Out Button - positioned in top left */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        zIndex: 1000
      }}>
        <Button variant="contained" color="error" onClick={signOut}>
          Sign Out
        </Button>
      </div>
      <FamilyTree />
    </div>
  );
}
