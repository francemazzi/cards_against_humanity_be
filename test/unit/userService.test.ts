/**
 * Unit Tests for User Service
 * Tests user authentication and CRUD operations
 */

import {
  hashApiKey,
  getApiKeyLast4,
  userToPublic,
  createUser,
  findUserByApiKey,
  findUserById,
  authenticateUser,
  updateUser,
  deleteUser,
  getAllUsers,
  getUserGames,
  getUserStats,
} from "../../src/core/userService";
import prisma from "../../src/db/prisma";
import type { User } from "../../src/core/types";

// --- Test Fixtures ---

const TEST_API_KEY = "sk-test-1234567890abcdefghijklmnop";
const TEST_API_KEY_2 = "sk-test-zyxwvutsrqponmlkjihgfedcba";
const TEST_API_KEY_HASH = hashApiKey(TEST_API_KEY);

function createMockUser(): User {
  return {
    id: "test-user-id",
    openaiKeyHash: TEST_API_KEY_HASH,
    openaiKeyLast4: "mnop",
    nickname: "TestUser",
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    lastLoginAt: new Date("2025-01-05"),
  };
}

// --- Utility Function Tests ---

describe("UserService - Utility Functions", () => {
  describe("hashApiKey", () => {
    it("should return a SHA-256 hash of the API key", () => {
      const hash = hashApiKey(TEST_API_KEY);
      
      // SHA-256 produces 64 character hex string
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]+$/);
    });

    it("should return consistent hash for same input", () => {
      const hash1 = hashApiKey(TEST_API_KEY);
      const hash2 = hashApiKey(TEST_API_KEY);
      
      expect(hash1).toBe(hash2);
    });

    it("should return different hashes for different inputs", () => {
      const hash1 = hashApiKey(TEST_API_KEY);
      const hash2 = hashApiKey(TEST_API_KEY_2);
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("getApiKeyLast4", () => {
    it("should return the last 4 characters of an API key", () => {
      const last4 = getApiKeyLast4(TEST_API_KEY);
      expect(last4).toBe("mnop");
    });

    it("should handle short strings", () => {
      const last4 = getApiKeyLast4("abc");
      expect(last4).toBe("abc");
    });
  });

  describe("userToPublic", () => {
    it("should convert User to UserPublic format", () => {
      const user = createMockUser();
      const publicUser = userToPublic(user);

      expect(publicUser).toEqual({
        id: "test-user-id",
        openaiKeyLast4: "mnop",
        nickname: "TestUser",
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      });
    });

    it("should not include sensitive fields", () => {
      const user = createMockUser();
      const publicUser = userToPublic(user);

      expect(publicUser).not.toHaveProperty("openaiKeyHash");
      expect(publicUser).not.toHaveProperty("updatedAt");
    });

    it("should handle undefined optional fields", () => {
      const user = createMockUser();
      user.nickname = undefined;
      user.lastLoginAt = undefined;

      const publicUser = userToPublic(user);

      expect(publicUser.nickname).toBeUndefined();
      expect(publicUser.lastLoginAt).toBeUndefined();
    });
  });
});

// --- Database CRUD Tests ---
// These tests require a database connection and should clean up after themselves

describe("UserService - CRUD Operations", () => {
  // Clean up test users before and after tests
  beforeEach(async () => {
    // Delete test users if they exist
    await prisma.user.deleteMany({
      where: {
        openaiKeyHash: {
          in: [hashApiKey(TEST_API_KEY), hashApiKey(TEST_API_KEY_2)],
        },
      },
    });
  });

  afterEach(async () => {
    // Clean up test users
    await prisma.user.deleteMany({
      where: {
        openaiKeyHash: {
          in: [hashApiKey(TEST_API_KEY), hashApiKey(TEST_API_KEY_2)],
        },
      },
    });
  });

  describe("createUser", () => {
    it("should create a new user with API key", async () => {
      const user = await createUser({
        openaiApiKey: TEST_API_KEY,
        nickname: "TestPlayer",
      });

      expect(user.id).toBeDefined();
      expect(user.openaiKeyHash).toBe(hashApiKey(TEST_API_KEY));
      expect(user.openaiKeyLast4).toBe("mnop");
      expect(user.nickname).toBe("TestPlayer");
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.lastLoginAt).toBeInstanceOf(Date);
    });

    it("should create user without nickname", async () => {
      const user = await createUser({
        openaiApiKey: TEST_API_KEY,
      });

      expect(user.id).toBeDefined();
      expect(user.nickname).toBeUndefined();
    });

    it("should return existing user if API key already registered", async () => {
      const user1 = await createUser({
        openaiApiKey: TEST_API_KEY,
        nickname: "FirstNickname",
      });

      const user2 = await createUser({
        openaiApiKey: TEST_API_KEY,
        nickname: "SecondNickname",
      });

      // Same user ID
      expect(user2.id).toBe(user1.id);
      // Nickname should be updated
      expect(user2.nickname).toBe("SecondNickname");
    });
  });

  describe("findUserByApiKey", () => {
    it("should find an existing user by API key", async () => {
      await createUser({
        openaiApiKey: TEST_API_KEY,
        nickname: "FindMe",
      });

      const user = await findUserByApiKey(TEST_API_KEY);

      expect(user).not.toBeNull();
      expect(user?.nickname).toBe("FindMe");
    });

    it("should return null for non-existent API key", async () => {
      const user = await findUserByApiKey("sk-nonexistent-key-12345678");
      expect(user).toBeNull();
    });
  });

  describe("findUserById", () => {
    it("should find an existing user by ID", async () => {
      const createdUser = await createUser({
        openaiApiKey: TEST_API_KEY,
        nickname: "FindById",
      });

      const user = await findUserById(createdUser.id);

      expect(user).not.toBeNull();
      expect(user?.id).toBe(createdUser.id);
      expect(user?.nickname).toBe("FindById");
    });

    it("should return null for non-existent ID", async () => {
      const user = await findUserById("nonexistent-uuid");
      expect(user).toBeNull();
    });
  });

  describe("authenticateUser", () => {
    it("should return existing user and update lastLoginAt", async () => {
      const createdUser = await createUser({
        openaiApiKey: TEST_API_KEY,
      });

      // Wait a bit to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      const authenticatedUser = await authenticateUser(TEST_API_KEY);

      expect(authenticatedUser.id).toBe(createdUser.id);
      expect(authenticatedUser.lastLoginAt).toBeDefined();
    });

    it("should create new user if not exists", async () => {
      const user = await authenticateUser(TEST_API_KEY_2);

      expect(user.id).toBeDefined();
      expect(user.openaiKeyHash).toBe(hashApiKey(TEST_API_KEY_2));
    });
  });

  describe("updateUser", () => {
    it("should update user nickname", async () => {
      const createdUser = await createUser({
        openaiApiKey: TEST_API_KEY,
        nickname: "OldNickname",
      });

      const updatedUser = await updateUser(createdUser.id, {
        nickname: "NewNickname",
      });

      expect(updatedUser.nickname).toBe("NewNickname");
    });

    it("should clear nickname when set to empty string", async () => {
      const createdUser = await createUser({
        openaiApiKey: TEST_API_KEY,
        nickname: "HasNickname",
      });

      const updatedUser = await updateUser(createdUser.id, {
        nickname: "",
      });

      expect(updatedUser.nickname).toBeUndefined();
    });
  });

  describe("deleteUser", () => {
    it("should delete an existing user", async () => {
      const createdUser = await createUser({
        openaiApiKey: TEST_API_KEY,
      });

      await deleteUser(createdUser.id);

      const user = await findUserById(createdUser.id);
      expect(user).toBeNull();
    });

    it("should throw error when deleting non-existent user", async () => {
      await expect(deleteUser("nonexistent-uuid")).rejects.toThrow();
    });
  });

  describe("getAllUsers", () => {
    it("should return all users as public info", async () => {
      await createUser({
        openaiApiKey: TEST_API_KEY,
        nickname: "User1",
      });

      await createUser({
        openaiApiKey: TEST_API_KEY_2,
        nickname: "User2",
      });

      const users = await getAllUsers();

      // Should have at least our test users
      expect(users.length).toBeGreaterThanOrEqual(2);
      
      // Check that users are in public format (no hash)
      users.forEach((user) => {
        expect(user).not.toHaveProperty("openaiKeyHash");
        expect(user).toHaveProperty("openaiKeyLast4");
      });
    });
  });
});

// --- Statistics Tests ---

describe("UserService - Statistics", () => {
  let testUserId: string;

  beforeEach(async () => {
    // Create a test user
    const user = await createUser({
      openaiApiKey: TEST_API_KEY,
      nickname: "StatsUser",
    });
    testUserId = user.id;
  });

  afterEach(async () => {
    // Clean up
    await prisma.user.deleteMany({
      where: {
        openaiKeyHash: hashApiKey(TEST_API_KEY),
      },
    });
  });

  describe("getUserGames", () => {
    it("should return empty array for user with no games", async () => {
      const games = await getUserGames(testUserId);
      expect(games).toEqual([]);
    });
  });

  describe("getUserStats", () => {
    it("should return zero stats for new user", async () => {
      const stats = await getUserStats(testUserId);

      expect(stats).toEqual({
        totalGames: 0,
        gamesWon: 0,
        totalRoundsPlayed: 0,
      });
    });
  });
});

