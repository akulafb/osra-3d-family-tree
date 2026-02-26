import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';

const HomePage = lazy(() => import('./pages/HomePage'));
const InvitePage = lazy(() => import('./pages/InvitePage'));

function PageFallback() {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        minHeight: '100vh',
        background: '#0a0a0a',
        color: '#fff',
      }}
      aria-busy="true"
    >
      <div>Loading <span style={{ fontFamily: 'cursive', fontWeight: 'bold' }}>Osra</span>...</div>
    </div>
  );
}

function App() {
  return (
    <>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/invite/:token" element={<InvitePage />} />
        </Routes>
      </Suspense>
      <Analytics />
    </>
  );
}

export default App;