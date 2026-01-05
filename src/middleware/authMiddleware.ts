// Authentication Middleware
// Validates OpenAI API key and attaches user to request

import { FastifyRequest, FastifyReply, FastifyInstance } from "fastify";
import * as userService from "../core/userService.js";
import * as llm from "../ai/llm.js";
import type { User } from "../core/types.js";

// Header name for OpenAI API key
export const OPENAI_KEY_HEADER = "x-openai-key";

// Extend FastifyRequest to include authenticated user
declare module "fastify" {
  interface FastifyRequest {
    user?: User;
    openaiApiKey?: string;
  }
}

/**
 * Extract API key from request headers
 */
export function getApiKeyFromRequest(request: FastifyRequest): string | undefined {
  return request.headers[OPENAI_KEY_HEADER] as string | undefined;
}

/**
 * Authentication hook - validates API key and attaches user to request
 * Use this for routes that require authentication
 */
export async function authenticationHook(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const apiKey = getApiKeyFromRequest(request);

  if (!apiKey) {
    reply.status(401).send({
      error: "Authentication required",
      message: `Please provide your OpenAI API key in the ${OPENAI_KEY_HEADER} header`,
    });
    return;
  }

  // Validate the API key format (basic check)
  if (!apiKey.startsWith("sk-")) {
    reply.status(401).send({
      error: "Invalid API key format",
      message: "OpenAI API keys should start with 'sk-'",
    });
    return;
  }

  try {
    // Authenticate/create user based on API key
    const user = await userService.authenticateUser(apiKey);
    
    // Attach user and API key to request
    request.user = user;
    request.openaiApiKey = apiKey;
  } catch (error) {
    reply.status(500).send({
      error: "Authentication failed",
      message: "Failed to authenticate user",
    });
  }
}

/**
 * Optional authentication hook - extracts user if API key provided, but doesn't require it
 * Use this for routes where authentication is optional
 */
export async function optionalAuthenticationHook(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const apiKey = getApiKeyFromRequest(request);

  if (!apiKey) {
    return; // No API key provided, continue without authentication
  }

  try {
    // Try to authenticate, but don't fail if it doesn't work
    const user = await userService.findUserByApiKey(apiKey);
    if (user) {
      request.user = user;
      request.openaiApiKey = apiKey;
    }
  } catch {
    // Ignore errors for optional authentication
  }
}

/**
 * Full authentication hook with API key validation against OpenAI
 * Use this for routes that need to verify the API key actually works
 */
export async function strictAuthenticationHook(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const apiKey = getApiKeyFromRequest(request);

  if (!apiKey) {
    reply.status(401).send({
      error: "Authentication required",
      message: `Please provide your OpenAI API key in the ${OPENAI_KEY_HEADER} header`,
    });
    return;
  }

  // Validate the API key with OpenAI
  const isValid = await llm.validateApiKey(apiKey);
  
  if (!isValid) {
    reply.status(401).send({
      error: "Invalid API key",
      message: "The provided OpenAI API key is invalid or expired",
    });
    return;
  }

  try {
    // Authenticate/create user
    const user = await userService.authenticateUser(apiKey);
    request.user = user;
    request.openaiApiKey = apiKey;
  } catch (error) {
    reply.status(500).send({
      error: "Authentication failed",
      message: "Failed to authenticate user",
    });
  }
}

/**
 * Register authentication plugin for Fastify
 * Adds authentication decorators to the Fastify instance
 */
export function registerAuthPlugin(fastify: FastifyInstance): void {
  // Decorate request with user and apiKey properties
  fastify.decorateRequest("user", null);
  fastify.decorateRequest("openaiApiKey", null);
}

