// Game API Routes
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import * as gameService from "../core/gameService.js";
import * as llm from "../ai/llm.js";

// Request body types
interface CreateGameBody {
  humanPlayerName: string;
  personas: string[];
  pointsToWin?: number;
}

interface PlayCardsBody {
  playerId: string;
  cardIds: string[];
}

interface JudgeBody {
  winnerIndex: number;
}

interface GameParams {
  gameId: string;
}

interface PlayerParams {
  gameId: string;
  playerId: string;
}

// Header type for OpenAI key
const OPENAI_KEY_HEADER = "x-openai-key";

// Helper to extract API key from headers
function getApiKeyFromRequest(request: FastifyRequest): string | undefined {
  return request.headers[OPENAI_KEY_HEADER] as string | undefined;
}

export async function registerGameRoute(fastify: FastifyInstance): Promise<void> {
  // Validate API key endpoint
  fastify.post(
    "/api/auth/validate-key",
    {
      schema: {
        description: "Validate an OpenAI API key",
        tags: ["Auth"],
        headers: {
          type: "object",
          properties: {
            [OPENAI_KEY_HEADER]: {
              type: "string",
              description: "Your OpenAI API key",
            },
          },
          required: [OPENAI_KEY_HEADER],
        },
        response: {
          200: {
            type: "object",
            properties: {
              valid: { type: "boolean" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const apiKey = getApiKeyFromRequest(request);

      if (!apiKey) {
        return reply.status(400).send({
          valid: false,
          message: "API key is required in X-OpenAI-Key header",
        });
      }

      const isValid = await llm.validateApiKey(apiKey);

      if (isValid) {
        return reply.send({
          valid: true,
          message: "API key is valid",
        });
      } else {
        return reply.status(401).send({
          valid: false,
          message: "Invalid API key",
        });
      }
    }
  );

  // Get available personas
  fastify.get(
    "/api/personas",
    {
      schema: {
        description: "Get list of available AI personas",
        tags: ["Game"],
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                description: { type: "string" },
              },
            },
          },
        },
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const personas = gameService.getAvailablePersonas();
      return reply.send(
        personas.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description || p.systemPrompt.substring(0, 100) + "...",
        }))
      );
    }
  );

  // Create new game
  fastify.post<{ Body: CreateGameBody }>(
    "/api/games",
    {
      schema: {
        description:
          "Create a new game. Requires OpenAI API key in X-OpenAI-Key header.",
        tags: ["Game"],
        headers: {
          type: "object",
          properties: {
            [OPENAI_KEY_HEADER]: {
              type: "string",
              description: "Your OpenAI API key (required for AI opponents)",
            },
          },
        },
        body: {
          type: "object",
          required: ["humanPlayerName", "personas"],
          properties: {
            humanPlayerName: { type: "string", minLength: 1 },
            personas: {
              type: "array",
              items: { type: "string" },
              minItems: 2,
              maxItems: 7,
            },
            pointsToWin: { type: "number", minimum: 1, maximum: 20 },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              gameId: { type: "string" },
              humanPlayerId: { type: "string" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: CreateGameBody }>,
      reply: FastifyReply
    ) => {
      const { humanPlayerName, personas, pointsToWin } = request.body;
      const apiKey = getApiKeyFromRequest(request);

      const { gameId, humanPlayerId } = await gameService.createGame(
        {
          humanPlayerName,
          personas,
          pointsToWin,
        },
        apiKey
      );

      return reply.status(201).send({
        gameId,
        humanPlayerId,
        message:
          "Game created. Connect via Socket.IO and call POST /api/games/:gameId/start to begin.",
      });
    }
  );

  // Start game
  fastify.post<{ Params: GameParams }>(
    "/api/games/:gameId/start",
    {
      schema: {
        description: "Start the game (deals cards, begins first round)",
        tags: ["Game"],
        headers: {
          type: "object",
          properties: {
            [OPENAI_KEY_HEADER]: {
              type: "string",
              description: "Your OpenAI API key",
            },
          },
        },
        params: {
          type: "object",
          properties: {
            gameId: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              message: { type: "string" },
              game: { type: "object" },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: GameParams }>,
      reply: FastifyReply
    ) => {
      const { gameId } = request.params;
      const apiKey = getApiKeyFromRequest(request);

      await gameService.startGame(gameId, apiKey);
      const gameResponse = gameService.getGameResponse(gameId);

      return reply.send({
        message: "Game started!",
        game: gameResponse,
      });
    }
  );

  // Get game state
  fastify.get<{ Params: GameParams }>(
    "/api/games/:gameId",
    {
      schema: {
        description: "Get current game state",
        tags: ["Game"],
        params: {
          type: "object",
          properties: {
            gameId: { type: "string" },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: GameParams }>,
      reply: FastifyReply
    ) => {
      const { gameId } = request.params;
      const gameResponse = gameService.getGameResponse(gameId);
      return reply.send(gameResponse);
    }
  );

  // Get player's hand
  fastify.get<{ Params: PlayerParams }>(
    "/api/games/:gameId/players/:playerId/hand",
    {
      schema: {
        description: "Get a player's current hand",
        tags: ["Game"],
        params: {
          type: "object",
          properties: {
            gameId: { type: "string" },
            playerId: { type: "string" },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: PlayerParams }>,
      reply: FastifyReply
    ) => {
      const { gameId, playerId } = request.params;
      const hand = gameService.getPlayerHand(gameId, playerId);
      return reply.send(hand);
    }
  );

  // Play cards (human player)
  fastify.post<{ Params: GameParams; Body: PlayCardsBody }>(
    "/api/games/:gameId/play",
    {
      schema: {
        description: "Play white card(s) for the current round",
        tags: ["Game"],
        headers: {
          type: "object",
          properties: {
            [OPENAI_KEY_HEADER]: {
              type: "string",
              description: "Your OpenAI API key",
            },
          },
        },
        params: {
          type: "object",
          properties: {
            gameId: { type: "string" },
          },
        },
        body: {
          type: "object",
          required: ["playerId", "cardIds"],
          properties: {
            playerId: { type: "string" },
            cardIds: {
              type: "array",
              items: { type: "string" },
              minItems: 1,
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: GameParams; Body: PlayCardsBody }>,
      reply: FastifyReply
    ) => {
      const { gameId } = request.params;
      const { playerId, cardIds } = request.body;
      const apiKey = getApiKeyFromRequest(request);

      await gameService.playHumanCards(gameId, playerId, cardIds, apiKey);
      const gameResponse = gameService.getGameResponse(gameId);

      return reply.send({
        message: "Cards played!",
        game: gameResponse,
      });
    }
  );

  // Judge winner (human czar)
  fastify.post<{ Params: GameParams; Body: JudgeBody }>(
    "/api/games/:gameId/judge",
    {
      schema: {
        description: "Judge and pick the winning submission (human czar only)",
        tags: ["Game"],
        headers: {
          type: "object",
          properties: {
            [OPENAI_KEY_HEADER]: {
              type: "string",
              description: "Your OpenAI API key",
            },
          },
        },
        params: {
          type: "object",
          properties: {
            gameId: { type: "string" },
          },
        },
        body: {
          type: "object",
          required: ["winnerIndex"],
          properties: {
            winnerIndex: { type: "number", minimum: 0 },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: GameParams; Body: JudgeBody }>,
      reply: FastifyReply
    ) => {
      const { gameId } = request.params;
      const { winnerIndex } = request.body;
      const apiKey = getApiKeyFromRequest(request);

      await gameService.humanJudge(gameId, winnerIndex, apiKey);
      const gameResponse = gameService.getGameResponse(gameId);

      return reply.send({
        message: "Winner selected!",
        game: gameResponse,
      });
    }
  );

  // Continue to next round
  fastify.post<{ Params: GameParams }>(
    "/api/games/:gameId/next-round",
    {
      schema: {
        description: "Start the next round",
        tags: ["Game"],
        headers: {
          type: "object",
          properties: {
            [OPENAI_KEY_HEADER]: {
              type: "string",
              description: "Your OpenAI API key",
            },
          },
        },
        params: {
          type: "object",
          properties: {
            gameId: { type: "string" },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: GameParams }>,
      reply: FastifyReply
    ) => {
      const { gameId } = request.params;
      const apiKey = getApiKeyFromRequest(request);

      await gameService.nextRound(gameId, apiKey);
      const gameResponse = gameService.getGameResponse(gameId);

      return reply.send({
        message: "Next round started!",
        game: gameResponse,
      });
    }
  );

  // Error handler for game routes
  fastify.setErrorHandler((error, _request, reply) => {
    fastify.log.error(error);
    reply.status(400).send({
      error: error.message || "An error occurred",
    });
  });
}
