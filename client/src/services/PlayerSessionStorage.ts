export class PlayerSessionStorage {
  private static readonly keyPrefix = "cah_player_id_";

  public static savePlayerId(gameId: string, playerId: string): void {
    localStorage.setItem(this.keyPrefix + gameId, playerId);
  }

  public static getPlayerId(gameId: string): string | null {
    return localStorage.getItem(this.keyPrefix + gameId);
  }

  public static clearPlayerId(gameId: string): void {
    localStorage.removeItem(this.keyPrefix + gameId);
  }
}


