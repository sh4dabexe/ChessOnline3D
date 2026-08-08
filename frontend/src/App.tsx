import { Routes, Route, Navigate } from 'react-router-dom';
import Lobby from './pages/Lobby';
import Game from './pages/Game';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Lobby />} />
      <Route path="/room/:code" element={<Game />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
