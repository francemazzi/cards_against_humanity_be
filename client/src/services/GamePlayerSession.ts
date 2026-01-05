import { PlayerSessionStorage } from "./PlayerSessionStorage";

export class GamePlayerSession {
  public static resolvePlayerId(gameId: string): string | null {
    return PlayerSessionStorage.getPlayerId(gameId);
  }

  public static requirePlayerId(gameId: string): string {
    const playerId = this.resolvePlayerId(gameId);
    if (!playerId) {
      throw new Error("Player session not found for this game");
    }
    return playerId;
  }
}


