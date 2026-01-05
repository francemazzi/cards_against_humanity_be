import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import type { AuthResponse, CreateGameResponse, GameResponse, WhiteCard, Persona } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3300';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add interceptor to add API key to requests
api.interceptors.request.use((config) => {
  const apiKey = localStorage.getItem('openai_key');
  if (apiKey) {
    config.headers['X-OpenAI-Key'] = apiKey;
  }
  return config;
});

export const authService = {
  register: async (apiKey: string, nickname: string): Promise<AuthResponse> => {
    const response = await api.post('/api/auth/register', { nickname }, {
      headers: {
        'X-OpenAI-Key': apiKey,
      }
    });
    return response.data;
  },
  
  validateKey: async (apiKey: string): Promise<boolean> => {
    try {
      await api.post('/api/auth/validate-key', {}, {
        headers: {
          'X-OpenAI-Key': apiKey,
        }
      });
      return true;
    } catch (e) {
      return false;
    }
  },
  
  getMe: async (): Promise<AuthResponse['user']> => {
    const response = await api.get('/api/users/me');
    return response.data;
  }
};

export const gameService = {
  create: async (body: { humanPlayerName: string; personas: string[]; pointsToWin?: number }): Promise<CreateGameResponse> => {
    const response = await api.post('/api/games', body);
    return response.data;
  },

  getPersonas: async (): Promise<Persona[]> => {
    const response = await api.get('/api/personas');
    return response.data;
  },
  
  start: async (gameId: string) => {
    const response = await api.post(`/api/games/${gameId}/start`);
    return response.data;
  },
  
  getGame: async (gameId: string): Promise<GameResponse> => {
    const response = await api.get(`/api/games/${gameId}`);
    return response.data;
  },
  
  getHand: async (gameId: string, playerId: string): Promise<{ hand: WhiteCard[] }> => {
    const response = await api.get(`/api/games/${gameId}/players/${playerId}/hand`);
    return response.data;
  }
};

export let socket: Socket;

export const initSocket = () => {
  socket = io(API_URL);
  return socket;
};

