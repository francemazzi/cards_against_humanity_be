// Game Service - orchestrates engine, database, and AI
// This is the "glue" layer that connects all pieces

import { v4 as uuidv4 } from "uuid";
import prisma from "../db/prisma.js";
import * as engine from "./engine.js";
import * as cards from "./cards.js";
import * as llm from "../ai/llm.js";
import * as socketManager from "../socket/SocketManager.js";
import type {
  GameState,
  Persona,
  BlackCard,
  WhiteCard,
  CreateGameRequest,
  GameResponse,
  PlayerHandResponse,
} from "./types.js";
import { DEFAULT_PERSONAS } from "./persona.js";

// In-memory game state cache (for active games)
const activeGames = new Map<string, GameState>();

// Store API keys per game (in production, use Redis or similar)
const gameApiKeys = new Map<string, string>();

// --- API KEY MANAGEMENT ---

export function setGameApiKey(gameId: string, apiKey: string): void {
  gameApiKeys.set(gameId, apiKey);
}

export function getGameApiKey(gameId: string): string | undefined {
  return gameApiKeys.get(gameId);
}

// --- GAME LIFECYCLE ---

export async function createGame(
  request: CreateGameRequest,
  openaiKey?: string
): Promise<{ gameId: string; humanPlayerId: string }> {
  const gameId = uuidv4();

  // Store API key for this game
  if (openaiKey) {
    gameApiKeys.set(gameId, openaiKey);
  }

  // Load cards
  const allWhite = cards.getAllWhiteCards();
  const allBlack = cards.getAllBlackCards();

  // Create game state
  const game = engine.createGameState(gameId, allBlack, allWhite, {
    pointsToWin: request.pointsToWin ?? 7,
  });

  // Add human player
  const humanPlayerId = uuidv4();
  const humanPlayer = engine.createPlayer(
    humanPlayerId,
    request.humanPlayerName,
    false
  );
  engine.addPlayer(game, humanPlayer);

  // Add AI players
  for (const personaIdOrName of request.personas) {
    const persona = findPersona(personaIdOrName);
    if (!persona) {
      throw new Error(`Persona not found: ${personaIdOrName}`);
    }
    const aiPlayer = engine.createPlayer(uuidv4(), persona.name, true, persona);
    engine.addPlayer(game, aiPlayer);
  }

  // Store in memory
  activeGames.set(gameId, game);

  // Persist to database
  await saveGameToDb(game);

  return { gameId, humanPlayerId };
}

export async function startGame(
  gameId: string,
  openaiKey?: string
): Promise<GameState> {
  const game = getGame(gameId);
  const apiKey = openaiKey || gameApiKeys.get(gameId);

  if (!engine.canStartGame(game)) {
    throw new Error("Cannot start game - need at least 3 players");
  }

  engine.startRound(game);

  // Broadcast round started
  const gameResponse = buildGameResponse(game);
  socketManager.broadcastRoundStarted(gameId, gameResponse);

  // AI players play their cards
  await processAITurns(game, apiKey);

  await saveGameToDb(game);
  return game;
}

export async function playHumanCards(
  gameId: string,
  playerId: string,
  cardIds: string[],
  openaiKey?: string
): Promise<GameState> {
  const game = getGame(gameId);
  const apiKey = openaiKey || gameApiKeys.get(gameId);

  engine.playCards(game, playerId, cardIds);

  // Broadcast cards played
  socketManager.broadcastCardsPlayed(gameId, {
    playerId,
    cardsCount: cardIds.length,
  });

  // If we moved to judging phase, broadcast and check if czar is AI
  if (game.status === "JUDGING") {
    const gameResponse = buildGameResponse(game);
    socketManager.broadcastJudgingStarted(gameId, gameResponse);
    await processAICzar(game, apiKey);
  }

  await saveGameToDb(game);

  // Broadcast updated state
  socketManager.broadcastGameState(gameId, buildGameResponse(game));

  return game;
}

export async function humanJudge(
  gameId: string,
  winnerIndex: number,
  openaiKey?: string
): Promise<GameState> {
  const game = getGame(gameId);
  const apiKey = openaiKey || gameApiKeys.get(gameId);
  const czar = engine.getCzar(game);

  if (czar?.isBot) {
    throw new Error("Human cannot judge - current czar is AI");
  }

  // Get winner info before judging
  const winnerEntry = game.table[winnerIndex];
  const winner = game.players.find((p) => p.id === winnerEntry?.playerId);

  engine.judgeWinner(game, winnerIndex);

  // Broadcast winner
  if (winner) {
    socketManager.broadcastWinnerSelected(gameId, {
      winnerId: winner.id,
      winnerName: winner.name,
      roundScore: winner.score,
    });
  }

  // Check for game over
  if (game.status === "GAME_OVER") {
    const gameWinner = game.players.find((p) => p.id === game.winnerId);
    socketManager.broadcastGameOver(gameId, {
      winnerId: game.winnerId || "",
      winnerName: gameWinner?.name || "",
      finalScores: game.players.map((p) => ({
        playerId: p.id,
        name: p.name,
        score: p.score,
      })),
    });
  } else if (game.status === "ROUND_ENDED") {
    engine.startRound(game);
    socketManager.broadcastRoundStarted(gameId, buildGameResponse(game));
    await processAITurns(game, apiKey);
  }

  await saveGameToDb(game);
  socketManager.broadcastGameState(gameId, buildGameResponse(game));

  return game;
}

export async function nextRound(
  gameId: string,
  openaiKey?: string
): Promise<GameState> {
  const game = getGame(gameId);
  const apiKey = openaiKey || gameApiKeys.get(gameId);

  if (game.status !== "ROUND_ENDED") {
    throw new Error("Cannot start next round from current state");
  }

  engine.startRound(game);

  // Broadcast round started
  socketManager.broadcastRoundStarted(gameId, buildGameResponse(game));

  await processAITurns(game, apiKey);

  await saveGameToDb(game);
  socketManager.broadcastGameState(gameId, buildGameResponse(game));

  return game;
}

// --- AI LOGIC ---

async function processAITurns(game: GameState, apiKey?: string): Promise<void> {
  if (game.status !== "PLAYING_CARDS") return;

  const botsToPlay = engine.getBotPlayersWhoNeedToPlay(game);

  for (const bot of botsToPlay) {
    if (!bot.persona || !game.currentBlackCard) continue;

    try {
      const cardIndex = await llm.pickCard(
        bot.persona,
        bot.hand,
        game.currentBlackCard,
        apiKey
      );

      const requiredCards = game.currentBlackCard.pick || 1;
      const cardIds = bot.hand
        .slice(cardIndex, cardIndex + requiredCards)
        .map((c) => c.id);

      engine.playCards(game, bot.id, cardIds);

      // Broadcast AI played
      socketManager.broadcastCardsPlayed(game.id, {
        playerId: bot.id,
        cardsCount: cardIds.length,
      });
    } catch (error) {
      console.error(`AI ${bot.name} failed to play:`, error);
      // Fallback: play first card(s)
      const requiredCards = game.currentBlackCard.pick || 1;
      const cardIds = bot.hand.slice(0, requiredCards).map((c) => c.id);
      engine.playCards(game, bot.id, cardIds);
    }
  }

  // If all played and czar is AI, process judging
  if ((game.status as string) === "JUDGING") {
    socketManager.broadcastJudgingStarted(game.id, buildGameResponse(game));
    await processAICzar(game, apiKey);
  }
}

async function processAICzar(game: GameState, apiKey?: string): Promise<void> {
  const czar = engine.getCzar(game);

  if (!czar?.isBot || !czar.persona || !game.currentBlackCard) return;

  try {
    const submissions = game.table.map((t) => t.cards);
    const winnerIndex = await llm.judgeCards(
      czar.persona,
      game.currentBlackCard,
      submissions,
      apiKey
    );

    // Get winner info
    const winnerEntry = game.table[winnerIndex];
    const winner = game.players.find((p) => p.id === winnerEntry?.playerId);

    engine.judgeWinner(game, winnerIndex);

    // Broadcast winner
    if (winner) {
      socketManager.broadcastWinnerSelected(game.id, {
        winnerId: winner.id,
        winnerName: winner.name,
        roundScore: winner.score,
      });
    }

    // Check for game over
    if (game.status === "GAME_OVER") {
      const gameWinner = game.players.find((p) => p.id === game.winnerId);
      socketManager.broadcastGameOver(game.id, {
        winnerId: game.winnerId || "",
        winnerName: gameWinner?.name || "",
        finalScores: game.players.map((p) => ({
          playerId: p.id,
          name: p.name,
          score: p.score,
        })),
      });
    } else if (game.status === "ROUND_ENDED") {
      engine.startRound(game);
      socketManager.broadcastRoundStarted(game.id, buildGameResponse(game));
      await processAITurns(game, apiKey);
    }
  } catch (error) {
    console.error(`AI Czar ${czar.name} failed to judge:`, error);
    // Fallback: pick first submission
    engine.judgeWinner(game, 0);
  }
}

// --- QUERY FUNCTIONS ---

export function getGame(gameId: string): GameState {
  const game = activeGames.get(gameId);
  if (!game) {
    throw new Error(`Game not found: ${gameId}`);
  }
  return game;
}

function buildGameResponse(game: GameState): GameResponse {
  const czar = engine.getCzar(game);

  return {
    id: game.id,
    status: game.status,
    round: game.round,
    players: game.players.map((p) => ({
      id: p.id,
      name: p.name,
      isBot: p.isBot,
      score: p.score,
      handCount: p.hand.length,
    })),
    czarId: czar?.id || "",
    currentBlackCard: game.currentBlackCard,
    table: game.table.map((t) => ({
      cards: t.cards,
      playerId:
        game.status === "ROUND_ENDED" || game.status === "GAME_OVER"
          ? t.playerId
          : undefined,
    })),
    winnerId: game.winnerId,
  };
}

export function getGameResponse(gameId: string): GameResponse {
  const game = getGame(gameId);
  return buildGameResponse(game);
}

export function getPlayerHand(
  gameId: string,
  playerId: string
): PlayerHandResponse {
  const game = getGame(gameId);
  const player = game.players.find((p) => p.id === playerId);

  if (!player) {
    throw new Error("Player not found");
  }

  return {
    hand: player.hand,
    requiredCards: game.currentBlackCard?.pick || 1,
  };
}

export function getAvailablePersonas(): Persona[] {
  return DEFAULT_PERSONAS;
}

function findPersona(idOrName: string): Persona | undefined {
  return DEFAULT_PERSONAS.find(
    (p) => p.id === idOrName || p.name.toLowerCase() === idOrName.toLowerCase()
  );
}

// --- DATABASE PERSISTENCE ---

async function saveGameToDb(game: GameState): Promise<void> {
  await prisma.game.upsert({
    where: { id: game.id },
    create: {
      id: game.id,
      status: game.status,
      round: game.round,
      czarIndex: game.czarIndex,
      pointsToWin: game.settings.pointsToWin,
      maxPlayers: game.settings.maxPlayers,
      currentBlackCard: game.currentBlackCard as any,
      deckBlackIds: game.deckBlack.map((c) => c.id),
      deckWhiteIds: game.deckWhite.map((c) => c.id),
      winnerId: game.winnerId,
      players: {
        create: game.players.map((p) => ({
          id: p.id,
          name: p.name,
          isBot: p.isBot,
          score: p.score,
          hand: p.hand as any[],
          personaId: p.persona?.id,
          personaName: p.persona?.name,
          systemPrompt: p.persona?.systemPrompt,
        })),
      },
    },
    update: {
      status: game.status,
      round: game.round,
      czarIndex: game.czarIndex,
      currentBlackCard: game.currentBlackCard as any,
      deckBlackIds: game.deckBlack.map((c) => c.id),
      deckWhiteIds: game.deckWhite.map((c) => c.id),
      winnerId: game.winnerId,
    },
  });

  // Update players separately
  for (const player of game.players) {
    await prisma.player.upsert({
      where: { id: player.id },
      create: {
        id: player.id,
        name: player.name,
        isBot: player.isBot,
        score: player.score,
        hand: player.hand as any[],
        personaId: player.persona?.id,
        personaName: player.persona?.name,
        systemPrompt: player.persona?.systemPrompt,
        gameId: game.id,
      },
      update: {
        score: player.score,
        hand: player.hand as any[],
      },
    });
  }

  // Save played cards for this round
  if (game.table.length > 0) {
    await prisma.playedCard.deleteMany({
      where: { gameId: game.id, round: game.round },
    });

    await prisma.playedCard.createMany({
      data: game.table.map((t) => ({
        playerId: t.playerId,
        gameId: game.id,
        round: game.round,
        cards: t.cards as any[],
      })),
    });
  }
}

export async function loadGameFromDb(
  gameId: string
): Promise<GameState | null> {
  const dbGame = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      players: true,
      playedCards: true,
    },
  });

  if (!dbGame) return null;

  // Reconstruct decks from IDs
  const allWhite = cards.getAllWhiteCards();
  const allBlack = cards.getAllBlackCards();

  const deckWhite = dbGame.deckWhiteIds
    .map((id) => allWhite.find((c) => c.id === id))
    .filter((c): c is WhiteCard => c !== undefined);

  const deckBlack = dbGame.deckBlackIds
    .map((id) => allBlack.find((c) => c.id === id))
    .filter((c): c is BlackCard => c !== undefined);

  // Filter played cards for current round
  const currentRoundCards = dbGame.playedCards.filter(
    (pc) => pc.round === dbGame.round
  );

  const game: GameState = {
    id: dbGame.id,
    status: dbGame.status,
    round: dbGame.round,
    czarIndex: dbGame.czarIndex,
    currentBlackCard: dbGame.currentBlackCard as BlackCard | null,
    deckBlack,
    deckWhite,
    players: dbGame.players.map((p) => ({
      id: p.id,
      name: p.name,
      isBot: p.isBot,
      score: p.score,
      hand: p.hand as unknown as WhiteCard[],
      persona: p.personaId
        ? {
            id: p.personaId,
            name: p.personaName || "",
            systemPrompt: p.systemPrompt || "",
          }
        : undefined,
    })),
    table: currentRoundCards.map((pc) => ({
      playerId: pc.playerId,
      cards: pc.cards as unknown as WhiteCard[],
    })),
    settings: {
      maxPlayers: dbGame.maxPlayers,
      pointsToWin: dbGame.pointsToWin,
    },
    winnerId: dbGame.winnerId || undefined,
  };

  activeGames.set(gameId, game);
  return game;
}
