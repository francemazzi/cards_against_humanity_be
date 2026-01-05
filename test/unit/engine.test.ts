/**
 * Unit Tests for Game Engine
 * Tests pure functional logic without external dependencies
 */

import {
  createGameState,
  createPlayer,
  addPlayer,
  canStartGame,
  startRound,
  playCards,
  judgeWinner,
  getCzar,
  getNonCzarPlayers,
  getPlayersWhoHaventPlayed,
  getBotPlayersWhoNeedToPlay,
  getWinner,
  shuffle,
} from "../../src/core/engine";
import type { BlackCard, WhiteCard, Persona, GameState } from "../../src/core/types";

// --- Test Fixtures ---

function createMockWhiteCards(count: number): WhiteCard[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `white_${i}`,
    text: `White card ${i}`,
    pack: 0,
  }));
}

function createMockBlackCards(count: number): BlackCard[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `black_${i}`,
    text: `Black card ${i} with _`,
    pick: 1,
    pack: 0,
  }));
}

function createMockPersona(id: string): Persona {
  return {
    id,
    name: `Test Persona ${id}`,
    systemPrompt: `You are a test persona ${id}`,
  };
}

function createTestGame(): GameState {
  const whiteCards = createMockWhiteCards(100);
  const blackCards = createMockBlackCards(20);
  return createGameState("test-game-id", blackCards, whiteCards);
}

// --- Tests ---

describe("Engine - createGameState", () => {
  it("should create a game with initial state", () => {
    const game = createTestGame();

    expect(game.id).toBe("test-game-id");
    expect(game.status).toBe("LOBBY");
    expect(game.round).toBe(0);
    expect(game.players).toHaveLength(0);
    expect(game.czarIndex).toBe(-1);
    expect(game.currentBlackCard).toBeNull();
    expect(game.table).toHaveLength(0);
    expect(game.deckBlack.length).toBe(20);
    expect(game.deckWhite.length).toBe(100);
  });

  it("should accept custom settings", () => {
    const whiteCards = createMockWhiteCards(50);
    const blackCards = createMockBlackCards(10);
    const game = createGameState("custom-game", blackCards, whiteCards, {
      pointsToWin: 5,
      maxPlayers: 4,
    });

    expect(game.settings.pointsToWin).toBe(5);
    expect(game.settings.maxPlayers).toBe(4);
  });

  it("should shuffle the decks", () => {
    const whiteCards = createMockWhiteCards(100);
    const blackCards = createMockBlackCards(20);
    
    const game1 = createGameState("game1", blackCards, whiteCards);
    const game2 = createGameState("game2", [...blackCards], [...whiteCards]);
    
    // The decks should be shuffled (very unlikely to be identical)
    // We check if at least one card is in a different position
    const differentPositions = game1.deckWhite.some(
      (card, index) => card.id !== game2.deckWhite[index]?.id
    );
    
    // This could theoretically fail, but probability is astronomically low
    expect(differentPositions).toBe(true);
  });
});

describe("Engine - createPlayer", () => {
  it("should create a human player", () => {
    const player = createPlayer("player-1", "Francesco", false);

    expect(player.id).toBe("player-1");
    expect(player.name).toBe("Francesco");
    expect(player.isBot).toBe(false);
    expect(player.score).toBe(0);
    expect(player.hand).toHaveLength(0);
    expect(player.persona).toBeUndefined();
  });

  it("should create an AI player with persona", () => {
    const persona = createMockPersona("caesar");
    const player = createPlayer("bot-1", "Giulio Cesare", true, persona);

    expect(player.id).toBe("bot-1");
    expect(player.name).toBe("Giulio Cesare");
    expect(player.isBot).toBe(true);
    expect(player.persona).toEqual(persona);
  });
});

describe("Engine - addPlayer", () => {
  it("should add a player to the game", () => {
    const game = createTestGame();
    const player = createPlayer("p1", "Player 1", false);

    addPlayer(game, player);

    expect(game.players).toHaveLength(1);
    expect(game.players[0]).toEqual(player);
  });

  it("should reject adding players after game starts", () => {
    const game = createTestGame();
    game.status = "PLAYING_CARDS";
    const player = createPlayer("p1", "Player 1", false);

    expect(() => addPlayer(game, player)).toThrow("Cannot add players after game has started");
  });

  it("should reject adding beyond max players", () => {
    const game = createTestGame();
    game.settings.maxPlayers = 2;

    addPlayer(game, createPlayer("p1", "Player 1", false));
    addPlayer(game, createPlayer("p2", "Player 2", false));

    expect(() => addPlayer(game, createPlayer("p3", "Player 3", false))).toThrow(
      "Max players reached"
    );
  });

  it("should reject duplicate players", () => {
    const game = createTestGame();
    const player = createPlayer("p1", "Player 1", false);

    addPlayer(game, player);

    expect(() => addPlayer(game, player)).toThrow("Player already in game");
  });
});

describe("Engine - canStartGame", () => {
  it("should return false with less than 3 players", () => {
    const game = createTestGame();
    addPlayer(game, createPlayer("p1", "Player 1", false));
    addPlayer(game, createPlayer("p2", "Player 2", false));

    expect(canStartGame(game)).toBe(false);
  });

  it("should return true with 3 or more players in lobby", () => {
    const game = createTestGame();
    addPlayer(game, createPlayer("p1", "Player 1", false));
    addPlayer(game, createPlayer("p2", "Player 2", true));
    addPlayer(game, createPlayer("p3", "Player 3", true));

    expect(canStartGame(game)).toBe(true);
  });

  it("should return false if not in lobby", () => {
    const game = createTestGame();
    addPlayer(game, createPlayer("p1", "Player 1", false));
    addPlayer(game, createPlayer("p2", "Player 2", true));
    addPlayer(game, createPlayer("p3", "Player 3", true));
    game.status = "PLAYING_CARDS";

    expect(canStartGame(game)).toBe(false);
  });
});

describe("Engine - startRound", () => {
  let game: GameState;

  beforeEach(() => {
    game = createTestGame();
    addPlayer(game, createPlayer("p1", "Human", false));
    addPlayer(game, createPlayer("p2", "Bot 1", true, createMockPersona("bot1")));
    addPlayer(game, createPlayer("p3", "Bot 2", true, createMockPersona("bot2")));
  });

  it("should deal 10 cards to each player", () => {
    startRound(game);

    game.players.forEach((player) => {
      expect(player.hand.length).toBe(10);
    });
  });

  it("should draw a black card", () => {
    const initialBlackCount = game.deckBlack.length;
    startRound(game);

    expect(game.currentBlackCard).not.toBeNull();
    expect(game.deckBlack.length).toBe(initialBlackCount - 1);
  });

  it("should rotate czar index", () => {
    expect(game.czarIndex).toBe(-1);

    startRound(game);
    expect(game.czarIndex).toBe(0);

    game.status = "ROUND_ENDED";
    startRound(game);
    expect(game.czarIndex).toBe(1);

    game.status = "ROUND_ENDED";
    startRound(game);
    expect(game.czarIndex).toBe(2);

    game.status = "ROUND_ENDED";
    startRound(game);
    expect(game.czarIndex).toBe(0); // Wraps around
  });

  it("should increment round number", () => {
    expect(game.round).toBe(0);

    startRound(game);
    expect(game.round).toBe(1);

    game.status = "ROUND_ENDED";
    startRound(game);
    expect(game.round).toBe(2);
  });

  it("should change status to PLAYING_CARDS", () => {
    startRound(game);
    expect(game.status).toBe("PLAYING_CARDS");
  });

  it("should clear the table", () => {
    game.table = [{ playerId: "old", cards: [] }];
    startRound(game);
    expect(game.table).toHaveLength(0);
  });

  it("should reject starting from invalid state", () => {
    game.status = "JUDGING";
    expect(() => startRound(game)).toThrow("Cannot start round from status");
  });
});

describe("Engine - playCards", () => {
  let game: GameState;

  beforeEach(() => {
    game = createTestGame();
    addPlayer(game, createPlayer("human", "Human", false));
    addPlayer(game, createPlayer("bot1", "Bot 1", true, createMockPersona("bot1")));
    addPlayer(game, createPlayer("bot2", "Bot 2", true, createMockPersona("bot2")));
    startRound(game);
  });

  it("should add cards to the table", () => {
    // Bot1 is not the czar (czar is human at index 0)
    const bot1 = game.players[1];
    const cardId = bot1.hand[0].id;

    playCards(game, "bot1", [cardId]);

    expect(game.table).toHaveLength(1);
    expect(game.table[0].playerId).toBe("bot1");
    expect(game.table[0].cards).toHaveLength(1);
  });

  it("should remove played cards from hand", () => {
    const bot1 = game.players[1];
    const cardId = bot1.hand[0].id;
    const initialHandSize = bot1.hand.length;

    playCards(game, "bot1", [cardId]);

    expect(bot1.hand.length).toBe(initialHandSize - 1);
    expect(bot1.hand.find((c) => c.id === cardId)).toBeUndefined();
  });

  it("should reject czar playing cards", () => {
    const czarId = game.players[game.czarIndex].id;
    const czarCard = game.players[game.czarIndex].hand[0].id;

    expect(() => playCards(game, czarId, [czarCard])).toThrow(
      "Czar cannot play cards"
    );
  });

  it("should reject playing cards not in hand", () => {
    expect(() => playCards(game, "bot1", ["invalid-card-id"])).toThrow(
      "Card invalid-card-id not in player's hand"
    );
  });

  it("should reject playing wrong number of cards", () => {
    game.currentBlackCard!.pick = 2;
    const bot1 = game.players[1];

    expect(() => playCards(game, "bot1", [bot1.hand[0].id])).toThrow(
      "Must play exactly 2 card(s)"
    );
  });

  it("should reject playing twice", () => {
    const bot1 = game.players[1];
    playCards(game, "bot1", [bot1.hand[0].id]);

    expect(() => playCards(game, "bot1", [bot1.hand[0].id])).toThrow(
      "Player already played this round"
    );
  });

  it("should transition to JUDGING when all non-czar players have played", () => {
    // Czar is player 0 (human), so bot1 and bot2 need to play
    const bot1 = game.players[1];
    const bot2 = game.players[2];

    playCards(game, "bot1", [bot1.hand[0].id]);
    expect(game.status).toBe("PLAYING_CARDS");

    playCards(game, "bot2", [bot2.hand[0].id]);
    expect(game.status).toBe("JUDGING");
  });
});

describe("Engine - judgeWinner", () => {
  let game: GameState;

  beforeEach(() => {
    game = createTestGame();
    game.settings.pointsToWin = 3;
    addPlayer(game, createPlayer("human", "Human", false));
    addPlayer(game, createPlayer("bot1", "Bot 1", true, createMockPersona("bot1")));
    addPlayer(game, createPlayer("bot2", "Bot 2", true, createMockPersona("bot2")));
    startRound(game);

    // Both bots play
    const bot1 = game.players[1];
    const bot2 = game.players[2];
    playCards(game, "bot1", [bot1.hand[0].id]);
    playCards(game, "bot2", [bot2.hand[0].id]);
  });

  it("should increment winner's score", () => {
    const initialScore = game.players[1].score;

    // Find winner index (table is shuffled, so we need to find bot1's entry)
    const bot1Index = game.table.findIndex((t) => t.playerId === "bot1");
    judgeWinner(game, bot1Index);

    expect(game.players[1].score).toBe(initialScore + 1);
  });

  it("should change status to ROUND_ENDED", () => {
    judgeWinner(game, 0);
    expect(game.status).toBe("ROUND_ENDED");
  });

  it("should end game when player reaches winning score", () => {
    // Set bot1's score to 2 (needs 1 more to win)
    game.players[1].score = 2;

    const bot1Index = game.table.findIndex((t) => t.playerId === "bot1");
    judgeWinner(game, bot1Index);

    expect(game.status).toBe("GAME_OVER");
    expect(game.winnerId).toBe("bot1");
  });

  it("should reject invalid winner index", () => {
    expect(() => judgeWinner(game, -1)).toThrow("Invalid winner index");
    expect(() => judgeWinner(game, 99)).toThrow("Invalid winner index");
  });

  it("should reject judging in wrong phase", () => {
    game.status = "PLAYING_CARDS";
    expect(() => judgeWinner(game, 0)).toThrow("Not in judging phase");
  });
});

describe("Engine - Query Functions", () => {
  let game: GameState;

  beforeEach(() => {
    game = createTestGame();
    addPlayer(game, createPlayer("human", "Human", false));
    addPlayer(game, createPlayer("bot1", "Bot 1", true, createMockPersona("bot1")));
    addPlayer(game, createPlayer("bot2", "Bot 2", true, createMockPersona("bot2")));
    startRound(game);
  });

  describe("getCzar", () => {
    it("should return the current czar", () => {
      const czar = getCzar(game);
      expect(czar).toBe(game.players[game.czarIndex]);
    });

    it("should return null for invalid czar index", () => {
      game.czarIndex = -1;
      expect(getCzar(game)).toBeNull();
    });
  });

  describe("getNonCzarPlayers", () => {
    it("should return all players except the czar", () => {
      const nonCzar = getNonCzarPlayers(game);
      expect(nonCzar).toHaveLength(2);
      expect(nonCzar.find((p) => p.id === game.players[game.czarIndex].id)).toBeUndefined();
    });
  });

  describe("getPlayersWhoHaventPlayed", () => {
    it("should return players who haven't played yet", () => {
      const notPlayed = getPlayersWhoHaventPlayed(game);
      expect(notPlayed).toHaveLength(2); // bot1 and bot2

      const bot1 = game.players[1];
      playCards(game, "bot1", [bot1.hand[0].id]);

      const notPlayedAfter = getPlayersWhoHaventPlayed(game);
      expect(notPlayedAfter).toHaveLength(1);
      expect(notPlayedAfter[0].id).toBe("bot2");
    });
  });

  describe("getBotPlayersWhoNeedToPlay", () => {
    it("should return only bots who haven't played", () => {
      // Make human the non-czar by changing czar index
      game.czarIndex = 1; // bot1 is czar

      const botsToPlay = getBotPlayersWhoNeedToPlay(game);
      // bot2 should play (bot1 is czar, human is not a bot)
      expect(botsToPlay).toHaveLength(1);
      expect(botsToPlay[0].id).toBe("bot2");
    });
  });

  describe("getWinner", () => {
    it("should return null when no winner", () => {
      expect(getWinner(game)).toBeNull();
    });

    it("should return the winner when game is over", () => {
      game.winnerId = "bot1";
      const winner = getWinner(game);
      expect(winner?.id).toBe("bot1");
    });
  });
});

describe("Engine - shuffle utility", () => {
  it("should return array of same length", () => {
    const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const shuffled = shuffle(original);
    expect(shuffled.length).toBe(original.length);
  });

  it("should contain all original elements", () => {
    const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const shuffled = shuffle(original);
    original.forEach((item) => {
      expect(shuffled).toContain(item);
    });
  });

  it("should not modify original array", () => {
    const original = [1, 2, 3, 4, 5];
    const copy = [...original];
    shuffle(original);
    expect(original).toEqual(copy);
  });
});

