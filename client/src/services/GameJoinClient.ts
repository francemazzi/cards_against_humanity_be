import { api } from "./api";

export interface JoinGameResponse {
  playerId: string;
}

export class GameJoinClient {
  public async joinGame(gameId: string, playerName?: string): Promise<JoinGameResponse> {
    const response = await api.post(`/api/games/${gameId}/join`, { playerName });
    return response.data;
  }
}


