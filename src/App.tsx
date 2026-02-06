import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import InvitePage from './pages/InvitePage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/invite/:token" element={<InvitePage />} />
    </Routes>
  );
}

export default App;