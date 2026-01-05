// Game Engine - Pure functional logic (Antirez style)
// No classes, just data structures and functions that transform state

import type {
  GameState,
  Player,
  BlackCard,
  WhiteCard,
  Persona,
  GameSettings,
} from "./types.js";

// --- CONSTANTS ---
const DEFAULT_HAND_SIZE = 10;
const DEFAULT_POINTS_TO_WIN = 7;
const DEFAULT_MAX_PLAYERS = 8;

// --- FACTORY FUNCTIONS ---

export function createGameState(
  id: string,
  allBlackCards: BlackCard[],
  allWhiteCards: WhiteCard[],
  settings?: Partial<GameSettings>
): GameState {
  return {
    id,
    status: "LOBBY",
    round: 0,
    deckBlack: shuffle([...allBlackCards]),
    deckWhite: shuffle([...allWhiteCards]),
    players: [],
    czarIndex: -1, // Will be 0 after first startRound
    currentBlackCard: null,
    table: [],
    settings: {
      maxPlayers: settings?.maxPlayers ?? DEFAULT_MAX_PLAYERS,
      pointsToWin: settings?.pointsToWin ?? DEFAULT_POINTS_TO_WIN,
    },
  };
}

export function createPlayer(
  id: string,
  name: string,
  isBot: boolean,
  persona?: Persona
): Player {
  return {
    id,
    name,
    isBot,
    score: 0,
    hand: [],
    persona,
  };
}

// --- GAME SETUP ---

export function addPlayer(game: GameState, player: Player): GameState {
  if (game.status !== "LOBBY") {
    throw new Error("Cannot add players after game has started");
  }
  if (game.players.length >= game.settings.maxPlayers) {
    throw new Error(`Max players reached (${game.settings.maxPlayers})`);
  }
  if (game.players.some((p) => p.id === player.id)) {
    throw new Error("Player already in game");
  }

  game.players.push(player);
  return game;
}

export function canStartGame(game: GameState): boolean {
  return game.status === "LOBBY" && game.players.length >= 3;
}

// --- ROUND MANAGEMENT ---

export function startRound(game: GameState): GameState {
  if (game.status !== "LOBBY" && game.status !== "ROUND_ENDED") {
    throw new Error(`Cannot start round from status: ${game.status}`);
  }
  if (game.players.length < 3) {
    throw new Error("Need at least 3 players to start");
  }
  if (game.deckBlack.length === 0) {
    game.status = "GAME_OVER";
    return game;
  }

  // 1. Rotate Czar
  game.czarIndex = (game.czarIndex + 1) % game.players.length;

  // 2. Deal cards to all players
  for (const player of game.players) {
    const need = DEFAULT_HAND_SIZE - player.hand.length;
    if (need > 0 && game.deckWhite.length >= need) {
      const drawn = game.deckWhite.splice(0, need);
      player.hand.push(...drawn);
    }
  }

  // 3. Draw black card
  game.currentBlackCard = game.deckBlack.pop() || null;

  // 4. Clear table and update state
  game.table = [];
  game.round++;
  game.status = "PLAYING_CARDS";

  return game;
}

// --- GAMEPLAY ---

export function playCards(
  game: GameState,
  playerId: string,
  cardIds: string[]
): GameState {
  if (game.status !== "PLAYING_CARDS") {
    throw new Error("Not in playing cards phase");
  }

  const player = game.players.find((p) => p.id === playerId);
  if (!player) {
    throw new Error("Player not found");
  }

  // Czar cannot play
  if (game.players[game.czarIndex].id === playerId) {
    throw new Error("Czar cannot play cards this round");
  }

  // Check if already played
  if (game.table.some((t) => t.playerId === playerId)) {
    throw new Error("Player already played this round");
  }

  // Validate card count
  const requiredCount = game.currentBlackCard?.pick || 1;
  if (cardIds.length !== requiredCount) {
    throw new Error(`Must play exactly ${requiredCount} card(s)`);
  }

  // Find and validate cards in hand
  const selectedCards: WhiteCard[] = [];
  for (const cardId of cardIds) {
    const card = player.hand.find((c) => c.id === cardId);
    if (!card) {
      throw new Error(`Card ${cardId} not in player's hand`);
    }
    selectedCards.push(card);
  }

  // Remove cards from hand
  player.hand = player.hand.filter((c) => !cardIds.includes(c.id));

  // Add to table
  game.table.push({
    playerId,
    cards: selectedCards,
  });

  // Check if all non-czar players have played
  const activePlayers = game.players.length - 1;
  if (game.table.length === activePlayers) {
    // Shuffle table for anonymity
    game.table = shuffle(game.table);
    game.status = "JUDGING";
  }

  return game;
}

export function judgeWinner(game: GameState, winnerIndex: number): GameState {
  if (game.status !== "JUDGING") {
    throw new Error("Not in judging phase");
  }

  if (winnerIndex < 0 || winnerIndex >= game.table.length) {
    throw new Error("Invalid winner index");
  }

  const winnerEntry = game.table[winnerIndex];
  const winner = game.players.find((p) => p.id === winnerEntry.playerId);

  if (winner) {
    winner.score++;

    // Check for game winner
    if (winner.score >= game.settings.pointsToWin) {
      game.status = "GAME_OVER";
      game.winnerId = winner.id;
      return game;
    }
  }

  game.status = "ROUND_ENDED";
  return game;
}

// --- QUERY FUNCTIONS ---

export function getCzar(game: GameState): Player | null {
  if (game.czarIndex < 0 || game.czarIndex >= game.players.length) {
    return null;
  }
  return game.players[game.czarIndex];
}

export function getNonCzarPlayers(game: GameState): Player[] {
  return game.players.filter((_, index) => index !== game.czarIndex);
}

export function getPlayersWhoHaventPlayed(game: GameState): Player[] {
  const playedIds = new Set(game.table.map((t) => t.playerId));
  return getNonCzarPlayers(game).filter((p) => !playedIds.has(p.id));
}

export function getBotPlayersWhoNeedToPlay(game: GameState): Player[] {
  return getPlayersWhoHaventPlayed(game).filter((p) => p.isBot);
}

export function getWinner(game: GameState): Player | null {
  if (!game.winnerId) return null;
  return game.players.find((p) => p.id === game.winnerId) || null;
}

// --- UTILITIES ---

function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  let currentIndex = result.length;
  let randomIndex: number;

  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [result[currentIndex], result[randomIndex]] = [
      result[randomIndex],
      result[currentIndex],
    ];
  }

  return result;
}

// Export for testing
export { shuffle };
