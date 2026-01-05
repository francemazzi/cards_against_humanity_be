import { v4 as uuidv4 } from "uuid";
import * as engine from "./engine.js";
import * as socketManager from "../socket/SocketManager.js";
import type { GameState, Player, User } from "./types.js";
import { getOrLoadGame, getGameResponse, persistGameState } from "./gameService.js";

export interface JoinGameResult {
  playerId: string;
}

export class GameLobbyService {
  public async joinGame(
    gameId: string,
    user: User,
    playerName?: string
  ): Promise<JoinGameResult> {
    const game = await getOrLoadGame(gameId);

    const resolvedName = playerName?.trim() || user.nickname?.trim() || "Player";
    const existing = this.findExistingHumanPlayer(game, user, resolvedName);
    if (existing) {
      return { playerId: existing.id };
    }

    if (game.status !== "LOBBY") {
      throw new Error("Player not found");
    }

    const created = this.createHumanPlayer(resolvedName, user.id);
    engine.addPlayer(game, created);

    await persistGameState(game);
    socketManager.broadcastGameState(gameId, getGameResponse(gameId));

    return { playerId: created.id };
  }

  private findExistingHumanPlayer(
    game: GameState,
    user: User,
    resolvedName: string
  ): Player | undefined {
    const humans = game.players.filter((p) => !p.isBot);
    if (humans.length === 0) return undefined;

    const byUserId = humans.find((p) => p.userId === user.id);
    if (byUserId) return byUserId;

    const byName = humans.find(
      (p) => p.name.toLowerCase() === resolvedName.toLowerCase()
    );
    if (byName) return byName;

    if (humans.length === 1) return humans[0];
    return undefined;
  }

  private createHumanPlayer(name: string, userId: string): Player {
    const player = engine.createPlayer(uuidv4(), name, false);
    player.userId = userId;
    return player;
  }
}


