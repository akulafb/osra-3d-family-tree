import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import InvitePage from './pages/InvitePage';
import { FamilyChat } from './components/FamilyChat';
import { useAuth } from './contexts/AuthContext';

function App() {
  const { user } = useAuth();

  return (
    <>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/invite/:token" element={<InvitePage />} />
      </Routes>
      {user && <FamilyChat />}
    </>
  );
}

export default App;