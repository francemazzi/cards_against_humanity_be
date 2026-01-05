import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { gameService, authService } from "../services/api";
import { useGameStore } from "../store/gameStore";
import { LogOut, Plus, Play, X, User as UserIcon } from "lucide-react";
import { PlayerSessionStorage } from "../services/PlayerSessionStorage";
import type { Persona } from "../types";

export const Lobby = () => {
  const [joinId, setJoinId] = useState("");
  const user = useGameStore((state) => state.user);
  const logout = useGameStore((state) => state.logout);
  const navigate = useNavigate();

  const [availablePersonas, setAvailablePersonas] = useState<Persona[]>([]);
  const [selectedPersonaIds, setSelectedPersonaIds] = useState<string[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [pointsToWin, setPointsToWin] = useState(5);

  useEffect(() => {
    const loadData = async () => {
      try {
        await authService.getMe();
        const personas = await gameService.getPersonas();
        setAvailablePersonas(personas);

        // Pre-select some personas if available, or defaults
        const defaults = ["gordon_ramsay", "mario"];
        const preselected = personas
          .filter((p) => defaults.includes(p.id))
          .map((p) => p.id);

        if (preselected.length > 0) {
          setSelectedPersonaIds(preselected);
        } else if (personas.length >= 2) {
          setSelectedPersonaIds([personas[0].id, personas[1].id]);
        }
      } catch (error: unknown) {
        console.error(error);
        // If auth fails, redirect
        if (
          (error as { response?: { status: number } })?.response?.status === 401
        ) {
          logout();
          navigate("/");
        }
      }
    };

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateGame = async () => {
    if (selectedPersonaIds.length < 2) {
      alert("Please select at least 2 AI players");
      return;
    }

    try {
      const { gameId, humanPlayerId } = await gameService.create({
        humanPlayerName: user?.nickname || "Player",
        personas: selectedPersonaIds,
        pointsToWin: pointsToWin,
      });
      PlayerSessionStorage.savePlayerId(gameId, humanPlayerId);
      setShowCreateModal(false);
      navigate(`/game/${gameId}`);
    } catch {
      alert("Failed to create game");
    }
  };

  const handleJoinGame = (e: React.FormEvent) => {
    e.preventDefault();
    if (joinId) {
      navigate(`/game/${joinId}`);
    }
  };

  const togglePersona = (id: string) => {
    setSelectedPersonaIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((p) => p !== id);
      }
      if (prev.length >= 7) {
        alert("Max 7 opponents allowed");
        return prev;
      }
      return [...prev, id];
    });
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <header className="flex justify-between items-center mb-12">
          <h1 className="text-4xl font-cah font-bold">
            Cards Against Humanity
          </h1>
          <div className="flex items-center gap-4">
            <span className="font-bold">{user?.nickname}</span>
            <button
              onClick={() => {
                logout();
                navigate("/");
              }}
              className="p-2 bg-black text-white rounded hover:bg-gray-800"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Create Game */}
          <div className="bg-white p-8 rounded-xl shadow-lg border-2 border-transparent hover:border-black transition-all">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Plus className="w-6 h-6" /> New Game
            </h2>
            <p className="text-gray-600 mb-6">
              Start a new game with AI personalities.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="w-full bg-black text-white font-bold py-4 rounded-lg text-lg hover:scale-105 transition-transform"
            >
              Setup Game
            </button>
          </div>

          {/* Join Game */}
          <div className="bg-white p-8 rounded-xl shadow-lg border-2 border-transparent hover:border-black transition-all">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Play className="w-6 h-6" /> Join Game
            </h2>
            <p className="text-gray-600 mb-6">
              Enter a game code to join an existing room.
            </p>
            <form onSubmit={handleJoinGame} className="flex gap-2">
              <input
                type="text"
                value={joinId}
                onChange={(e) => setJoinId(e.target.value)}
                placeholder="Game ID"
                className="flex-1 p-4 border-2 border-black rounded-lg font-bold"
                required
              />
              <button
                type="submit"
                className="bg-black text-white font-bold px-6 rounded-lg hover:bg-gray-800"
              >
                Join
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Create Game Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
              <h3 className="text-2xl font-bold">Setup New Game</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 hover:bg-gray-200 rounded-full"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="mb-8">
                <label className="block font-bold mb-2">Points to Win</label>
                <input
                  type="range"
                  min="3"
                  max="20"
                  value={pointsToWin}
                  onChange={(e) => setPointsToWin(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="text-center mt-2 font-mono text-xl">
                  {pointsToWin} Points
                </div>
              </div>

              <div>
                <div className="flex justify-between items-end mb-4">
                  <label className="block font-bold text-lg">
                    Select Opponents ({selectedPersonaIds.length}/7)
                  </label>
                  <span className="text-sm text-gray-500">
                    Select at least 2
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {availablePersonas.map((persona) => (
                    <div
                      key={persona.id}
                      onClick={() => togglePersona(persona.id)}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedPersonaIds.includes(persona.id)
                          ? "border-black bg-black text-white"
                          : "border-gray-200 hover:border-gray-400"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className="font-bold truncate pr-2">
                          {persona.name}
                        </span>
                        {selectedPersonaIds.includes(persona.id) && (
                          <UserIcon size={16} fill="white" />
                        )}
                      </div>
                      <p
                        className={`text-sm ${
                          selectedPersonaIds.includes(persona.id)
                            ? "text-gray-300"
                            : "text-gray-500"
                        } line-clamp-3`}
                      >
                        {persona.description || persona.systemPrompt}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t bg-gray-50 rounded-b-xl flex justify-end gap-4">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-6 py-3 font-bold hover:bg-gray-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateGame}
                disabled={selectedPersonaIds.length < 2}
                className="px-8 py-3 bg-black text-white font-bold rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Start Game
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
