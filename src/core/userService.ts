// User Service - manages user authentication and CRUD operations
// Users are identified by their OpenAI API key (hashed for security)

import { createHash } from "crypto";
import { v4 as uuidv4 } from "uuid";
import prisma from "../db/prisma.js";
import type { User, UserPublic, CreateUserRequest, UpdateUserRequest } from "./types.js";

// ============ UTILITY FUNCTIONS ============

/**
 * Hash an OpenAI API key using SHA-256
 * This is used as the unique identifier for users
 */
export function hashApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex");
}

/**
 * Extract the last 4 characters of an API key for display purposes
 */
export function getApiKeyLast4(apiKey: string): string {
  return apiKey.slice(-4);
}

/**
 * Convert a database user to the internal User type
 */
function dbUserToUser(dbUser: {
  id: string;
  openaiKeyHash: string;
  openaiKeyLast4: string;
  nickname: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}): User {
  return {
    id: dbUser.id,
    openaiKeyHash: dbUser.openaiKeyHash,
    openaiKeyLast4: dbUser.openaiKeyLast4,
    nickname: dbUser.nickname ?? undefined,
    createdAt: dbUser.createdAt,
    updatedAt: dbUser.updatedAt,
    lastLoginAt: dbUser.lastLoginAt ?? undefined,
  };
}

/**
 * Convert a User to the public representation (hides sensitive data)
 */
export function userToPublic(user: User): UserPublic {
  return {
    id: user.id,
    openaiKeyLast4: user.openaiKeyLast4,
    nickname: user.nickname,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

// ============ CRUD OPERATIONS ============

/**
 * Create a new user or return existing user if API key is already registered
 * This implements "upsert" logic - same key = same user
 */
export async function createUser(request: CreateUserRequest): Promise<User> {
  const keyHash = hashApiKey(request.openaiApiKey);
  const keyLast4 = getApiKeyLast4(request.openaiApiKey);

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { openaiKeyHash: keyHash },
  });

  if (existingUser) {
    // User exists - update lastLoginAt and optionally nickname
    const updatedUser = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        lastLoginAt: new Date(),
        ...(request.nickname && { nickname: request.nickname }),
      },
    });
    return dbUserToUser(updatedUser);
  }

  // Create new user
  const newUser = await prisma.user.create({
    data: {
      id: uuidv4(),
      openaiKeyHash: keyHash,
      openaiKeyLast4: keyLast4,
      nickname: request.nickname ?? null,
      lastLoginAt: new Date(),
    },
  });

  return dbUserToUser(newUser);
}

/**
 * Find a user by their API key
 */
export async function findUserByApiKey(apiKey: string): Promise<User | null> {
  const keyHash = hashApiKey(apiKey);
  
  const user = await prisma.user.findUnique({
    where: { openaiKeyHash: keyHash },
  });

  if (!user) {
    return null;
  }

  return dbUserToUser(user);
}

/**
 * Find a user by their ID
 */
export async function findUserById(id: string): Promise<User | null> {
  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    return null;
  }

  return dbUserToUser(user);
}

/**
 * Get or create a user from an API key
 * This is the main authentication method
 */
export async function authenticateUser(apiKey: string): Promise<User> {
  const existingUser = await findUserByApiKey(apiKey);
  
  if (existingUser) {
    // Update last login time
    await prisma.user.update({
      where: { id: existingUser.id },
      data: { lastLoginAt: new Date() },
    });
    return { ...existingUser, lastLoginAt: new Date() };
  }

  // Auto-create user on first authentication
  return createUser({ openaiApiKey: apiKey });
}

/**
 * Update user information
 */
export async function updateUser(
  id: string,
  data: UpdateUserRequest
): Promise<User> {
  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(data.nickname !== undefined && { nickname: data.nickname || null }),
    },
  });

  return dbUserToUser(user);
}

/**
 * Delete a user by ID
 */
export async function deleteUser(id: string): Promise<void> {
  await prisma.user.delete({
    where: { id },
  });
}

/**
 * Delete a user by their API key
 */
export async function deleteUserByApiKey(apiKey: string): Promise<void> {
  const keyHash = hashApiKey(apiKey);
  
  await prisma.user.delete({
    where: { openaiKeyHash: keyHash },
  });
}

/**
 * Get all users (admin function - returns public info only)
 */
export async function getAllUsers(): Promise<UserPublic[]> {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
  });

  return users.map((u) => userToPublic(dbUserToUser(u)));
}

/**
 * Get user's games (owned games)
 */
export async function getUserGames(userId: string): Promise<{ id: string; status: string; createdAt: Date }[]> {
  const games = await prisma.game.findMany({
    where: { ownerId: userId },
    select: {
      id: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return games;
}

/**
 * Get user statistics
 */
export async function getUserStats(userId: string): Promise<{
  totalGames: number;
  gamesWon: number;
  totalRoundsPlayed: number;
}> {
  // Count owned games
  const totalGames = await prisma.game.count({
    where: { ownerId: userId },
  });

  // Count games won (where user's player won)
  const gamesWon = await prisma.game.count({
    where: {
      ownerId: userId,
      status: "GAME_OVER",
      players: {
        some: {
          userId: userId,
          game: {
            winnerId: { not: null },
          },
        },
      },
    },
  });

  // Count rounds played
  const roundsPlayed = await prisma.playedCard.count({
    where: {
      player: {
        userId: userId,
      },
    },
  });

  return {
    totalGames,
    gamesWon,
    totalRoundsPlayed: roundsPlayed,
  };
}

