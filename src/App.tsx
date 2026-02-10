import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import InvitePage from './pages/InvitePage';
import { PermissionTest } from './components/PermissionTest';

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/invite/:token" element={<InvitePage />} />
      <Route path="/debug" element={<PermissionTest />} />
    </Routes>
  );
}

export default App;