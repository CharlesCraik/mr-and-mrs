import { Navigate, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import CreateGame from './pages/CreateGame';
import HostPage from './pages/HostPage';
import JoinPage from './pages/JoinPage';
import PlayPage from './pages/PlayPage';
import DemoPage from './pages/DemoPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/create" element={<CreateGame />} />
      <Route path="/host/:gameId" element={<HostPage />} />
      <Route path="/join" element={<JoinPage />} />
      <Route path="/join/:code" element={<JoinPage />} />
      <Route path="/play/:gameId" element={<PlayPage />} />
      <Route path="/demo" element={<DemoPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
