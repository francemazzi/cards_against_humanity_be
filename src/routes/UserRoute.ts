// User API Routes
// CRUD operations for user management with OpenAI API key authentication

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import * as userService from "../core/userService.js";
import * as llm from "../ai/llm.js";
import {
  authenticationHook,
  OPENAI_KEY_HEADER,
  getApiKeyFromRequest,
} from "../middleware/authMiddleware.js";

// Request body types
interface UpdateNicknameBody {
  nickname?: string;
}

export async function registerUserRoute(fastify: FastifyInstance): Promise<void> {
  // ============ AUTH ENDPOINTS ============

  /**
   * POST /api/auth/register
   * Register/login with OpenAI API key
   * Creates a new user if not exists, otherwise returns existing user
   */
  fastify.post(
    "/api/auth/register",
    {
      schema: {
        description: "Register or login with OpenAI API key. Creates user if not exists.",
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
        body: {
          type: "object",
          properties: {
            nickname: { type: "string", minLength: 1, maxLength: 50 },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              user: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  openaiKeyLast4: { type: "string" },
                  nickname: { type: "string" },
                  createdAt: { type: "string" },
                  lastLoginAt: { type: "string" },
                },
              },
              message: { type: "string" },
              isNewUser: { type: "boolean" },
            },
          },
          401: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: { nickname?: string } }>,
      reply: FastifyReply
    ) => {
      const apiKey = getApiKeyFromRequest(request);

      if (!apiKey) {
        return reply.status(401).send({
          error: "API key required",
          message: `Please provide your OpenAI API key in the ${OPENAI_KEY_HEADER} header`,
        });
      }

      // Validate API key with OpenAI
      const isValid = await llm.validateApiKey(apiKey);
      if (!isValid) {
        return reply.status(401).send({
          error: "Invalid API key",
          message: "The provided OpenAI API key is invalid or expired",
        });
      }

      // Check if user already exists
      const existingUser = await userService.findUserByApiKey(apiKey);
      const isNewUser = !existingUser;

      // Create or update user
      const user = await userService.createUser({
        openaiApiKey: apiKey,
        nickname: request.body?.nickname,
      });

      return reply.send({
        user: userService.userToPublic(user),
        message: isNewUser ? "User registered successfully" : "Welcome back!",
        isNewUser,
      });
    }
  );

  /**
   * POST /api/auth/validate-key
   * Validate an OpenAI API key without creating a user
   */
  fastify.post(
    "/api/auth/validate-key",
    {
      schema: {
        description: "Validate an OpenAI API key without creating a user",
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

  // ============ USER CRUD ENDPOINTS ============

  /**
   * GET /api/users/me
   * Get current authenticated user's profile
   */
  fastify.get(
    "/api/users/me",
    {
      preHandler: authenticationHook,
      schema: {
        description: "Get current authenticated user's profile",
        tags: ["Users"],
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
              id: { type: "string" },
              openaiKeyLast4: { type: "string" },
              nickname: { type: "string" },
              createdAt: { type: "string" },
              lastLoginAt: { type: "string" },
            },
          },
          401: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user!;
      return reply.send(userService.userToPublic(user));
    }
  );

  /**
   * PUT /api/users/me
   * Update current authenticated user's profile
   */
  fastify.put<{ Body: UpdateNicknameBody }>(
    "/api/users/me",
    {
      preHandler: authenticationHook,
      schema: {
        description: "Update current authenticated user's profile",
        tags: ["Users"],
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
        body: {
          type: "object",
          properties: {
            nickname: { type: "string", minLength: 1, maxLength: 50 },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              openaiKeyLast4: { type: "string" },
              nickname: { type: "string" },
              createdAt: { type: "string" },
              lastLoginAt: { type: "string" },
            },
          },
          401: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const user = request.user!;
      const { nickname } = request.body;

      const updatedUser = await userService.updateUser(user.id, { nickname });
      return reply.send(userService.userToPublic(updatedUser));
    }
  );

  /**
   * DELETE /api/users/me
   * Delete current authenticated user's account
   */
  fastify.delete(
    "/api/users/me",
    {
      preHandler: authenticationHook,
      schema: {
        description: "Delete current authenticated user's account",
        tags: ["Users"],
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
              message: { type: "string" },
            },
          },
          401: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user!;
      await userService.deleteUser(user.id);
      return reply.send({ message: "User deleted successfully" });
    }
  );

  /**
   * GET /api/users/me/games
   * Get current authenticated user's games
   */
  fastify.get(
    "/api/users/me/games",
    {
      preHandler: authenticationHook,
      schema: {
        description: "Get current authenticated user's games",
        tags: ["Users"],
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
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                status: { type: "string" },
                createdAt: { type: "string" },
              },
            },
          },
          401: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user!;
      const games = await userService.getUserGames(user.id);
      return reply.send(games);
    }
  );

  /**
   * GET /api/users/me/stats
   * Get current authenticated user's statistics
   */
  fastify.get(
    "/api/users/me/stats",
    {
      preHandler: authenticationHook,
      schema: {
        description: "Get current authenticated user's statistics",
        tags: ["Users"],
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
              totalGames: { type: "number" },
              gamesWon: { type: "number" },
              totalRoundsPlayed: { type: "number" },
            },
          },
          401: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user!;
      const stats = await userService.getUserStats(user.id);
      return reply.send(stats);
    }
  );

  // Error handler for user routes
  fastify.setErrorHandler((error, _request, reply) => {
    fastify.log.error(error);
    reply.status(400).send({
      error: error.message || "An error occurred",
    });
  });
}

