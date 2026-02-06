import FamilyTree3D from '../components/FamilyTree3D';
import { useAuth } from '../contexts/AuthContext';

export default function HomePage() {
  const { user, isLoading, signInWithGoogle, signOut, isBound } = useAuth();

  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        color: 'white'
      }}>
        Loading...
      </div>
    );
  }

  // If not logged in, show login screen
  if (!user) {
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
        <h1 style={{ color: 'white', fontSize: '3rem', marginBottom: '10px' }}>
          3D Family Tree
        </h1>
        <p style={{ color: 'white', fontSize: '1.2rem', marginBottom: '20px' }}>
          Explore your family connections in 3D space
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
          Sign in with Google
        </button>
      </div>
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
        <button
          onClick={signOut}
          style={{
            padding: '12px 30px',
            fontSize: '1rem',
            background: 'rgba(255,255,255,0.2)',
            border: '2px solid white',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold',
            color: 'white'
          }}
        >
          Sign Out
        </button>
      </div>
    );
  }

  // Logged in and bound - show the 3D tree
  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <div style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        zIndex: 1000
      }}>
        <button
          onClick={signOut}
          style={{
            padding: '10px 20px',
            background: 'rgba(255,255,255,0.9)',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
        >
          Sign Out
        </button>
      </div>
      <FamilyTree3D />
    </div>
  );
}
