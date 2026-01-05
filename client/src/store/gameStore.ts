import { create } from 'zustand';
import type { AuthResponse, GameResponse, WhiteCard } from '../types';

interface GameState {
  user: AuthResponse['user'] | null;
  isAuthenticated: boolean;
  game: GameResponse | null;
  hand: WhiteCard[];
  setUser: (user: AuthResponse['user']) => void;
  setGame: (game: GameResponse | null) => void;
  setHand: (hand: WhiteCard[]) => void;
  logout: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  user: null,
  isAuthenticated: false,
  game: null,
  hand: [],
  setUser: (user) => set({ user, isAuthenticated: true }),
  setGame: (game) => set({ game }),
  setHand: (hand) => set({ hand }),
  logout: () => {
    localStorage.removeItem('openai_key');
    set({ user: null, isAuthenticated: false, game: null, hand: [] });
  },
}));

