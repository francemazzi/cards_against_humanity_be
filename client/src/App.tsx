import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { Lobby } from './pages/Lobby';
import { GameRoom } from './pages/GameRoom';
import { useGameStore } from './store/gameStore';

function App() {
  const isAuthenticated = useGameStore(state => state.isAuthenticated);
  // Also check if user is restored (localStorage) - handled in Login component logic primarily, 
  // but for protection we might want a loading state. 
  // For now, simple protection.

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route 
          path="/lobby" 
          element={isAuthenticated ? <Lobby /> : <Navigate to="/" />} 
        />
        <Route 
          path="/game/:gameId" 
          element={isAuthenticated ? <GameRoom /> : <Navigate to="/" />} 
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
