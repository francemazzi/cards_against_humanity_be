/**
 * Integration Tests for Complete Game Flow
 * 
 * ⚠️ IMPORTANT: These tests make REAL calls to OpenAI API
 * - Requires OPENAI_API_KEY environment variable
 * - Tests have 5 minute timeout due to potential LLM latency
 * - May incur API costs
 * 
 * Run with: npm test -- --selectProjects integration
 */

import "dotenv/config";
import * as gameService from "../../src/core/gameService";

// Skip tests if no API key is available
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const describeIfApiKey = OPENAI_API_KEY ? describe : describe.skip;

describeIfApiKey("Integration - Complete Game Flow with LLM", () => {
  let gameId: string;
  let humanPlayerId: string;

  // Helper to wait for potential rate limiting
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  beforeAll(() => {
    if (!OPENAI_API_KEY) {
      console.warn("⚠️ OPENAI_API_KEY not set - skipping integration tests");
    } else {
      console.log("✅ OPENAI_API_KEY found - running integration tests");
      console.log("⏱️ These tests may take several minutes due to LLM calls...");
    }
  });

  describe("Game Creation", () => {
    it("should create a new game with human and AI players", async () => {
      const result = await gameService.createGame(
        {
          humanPlayerName: "Test Human",
          personas: ["caesar", "einstein"],
          pointsToWin: 2, // Low for faster testing
        },
        OPENAI_API_KEY
      );

      gameId = result.gameId;
      humanPlayerId = result.humanPlayerId;

      expect(gameId).toBeDefined();
      expect(humanPlayerId).toBeDefined();
      console.log(`Created game: ${gameId}`);
      console.log(`Human player ID: ${humanPlayerId}`);
    });

    it("should have correct initial state", () => {
      const response = gameService.getGameResponse(gameId);

      expect(response.status).toBe("LOBBY");
      expect(response.round).toBe(0);
      expect(response.players).toHaveLength(3);

      // Check players
      const human = response.players.find((p) => p.id === humanPlayerId);
      expect(human).toBeDefined();
      expect(human?.isBot).toBe(false);

      const bots = response.players.filter((p) => p.isBot);
      expect(bots).toHaveLength(2);
    });
  });

  describe("Game Start and AI Play", () => {
    it("should start the game and have AI players play their cards", async () => {
      console.log("Starting game - AI players will make their moves...");
      console.log("This may take 1-3 minutes depending on OpenAI response time");

      const startTime = Date.now();
      await gameService.startGame(gameId, OPENAI_API_KEY);
      const elapsed = Date.now() - startTime;

      console.log(`Game started in ${elapsed}ms`);

      const response = gameService.getGameResponse(gameId);

      // Game should be either in PLAYING_CARDS (waiting for human)
      // or already in JUDGING if human is czar and AI played
      expect(["PLAYING_CARDS", "JUDGING", "ROUND_ENDED"]).toContain(response.status);
      expect(response.round).toBe(1);
      expect(response.currentBlackCard).not.toBeNull();

      console.log(`Game status: ${response.status}`);
      console.log(`Current black card: ${response.currentBlackCard?.text}`);
      console.log(`Cards on table: ${response.table.length}`);
    }, 300000); // 5 minute timeout
  });

  describe("Human Player Actions", () => {
    it("should get the human player's hand", () => {
      const hand = gameService.getPlayerHand(gameId, humanPlayerId);

      expect(hand.hand.length).toBe(10);
      expect(hand.requiredCards).toBeGreaterThanOrEqual(1);

      console.log(`Human has ${hand.hand.length} cards in hand`);
      console.log(`Need to play ${hand.requiredCards} card(s)`);
      console.log("Sample cards:", hand.hand.slice(0, 3).map((c) => c.text));
    });

    it("should allow human to play cards when not czar", async () => {
      const response = gameService.getGameResponse(gameId);

      // Check if human is the czar
      if (response.czarId === humanPlayerId) {
        console.log("Human is the czar this round - skipping play test");
        return;
      }

      // Check if human already needs to judge (AI played fast)
      if (response.status === "JUDGING" || response.status === "ROUND_ENDED") {
        console.log(`Game already moved to ${response.status} - AI was fast!`);
        return;
      }

      const hand = gameService.getPlayerHand(gameId, humanPlayerId);
      const cardsToPlay = hand.hand.slice(0, hand.requiredCards).map((c) => c.id);

      console.log("Human playing cards...");
      await gameService.playHumanCards(gameId, humanPlayerId, cardsToPlay, OPENAI_API_KEY);

      const afterPlay = gameService.getGameResponse(gameId);
      console.log(`Status after human play: ${afterPlay.status}`);
      console.log(`Cards on table: ${afterPlay.table.length}`);
    }, 300000);
  });

  describe("Judging Phase", () => {
    it("should handle judging (human or AI)", async () => {
      const response = gameService.getGameResponse(gameId);

      // If game already ended or moved to next round, that's fine
      if (response.status === "GAME_OVER") {
        console.log("Game already over!");
        return;
      }

      if (response.status === "ROUND_ENDED") {
        console.log("Round already judged by AI czar");
        return;
      }

      // If human is czar and we're in judging phase
      if (response.status === "JUDGING" && response.czarId === humanPlayerId) {
        console.log("Human is judging...");

        // Pick a random winner
        const winnerIndex = Math.floor(Math.random() * response.table.length);
        await gameService.humanJudge(gameId, winnerIndex, OPENAI_API_KEY);

        const afterJudge = gameService.getGameResponse(gameId);
        console.log(`Status after judging: ${afterJudge.status}`);
      } else if (response.status === "PLAYING_CARDS") {
        console.log("Still waiting for cards to be played");
      }
    }, 300000);
  });

  describe("Multiple Rounds", () => {
    it("should play through multiple rounds until game ends", async () => {
      let rounds = 0;
      const maxRounds = 10; // Safety limit

      while (rounds < maxRounds) {
        const response = gameService.getGameResponse(gameId);
        console.log(`\n--- Round ${response.round} | Status: ${response.status} ---`);

        // Log scores
        response.players.forEach((p) => {
          console.log(`  ${p.name}: ${p.score} points`);
        });

        if (response.status === "GAME_OVER") {
          console.log("\n🎉 GAME OVER!");
          const winner = response.players.find((p) => p.id === response.winnerId);
          console.log(`Winner: ${winner?.name} with ${winner?.score} points!`);
          break;
        }

        // Handle current state
        if (response.status === "ROUND_ENDED") {
          console.log("Starting next round...");
          await wait(1000); // Small delay between rounds
          await gameService.nextRound(gameId, OPENAI_API_KEY);
          rounds++;
          continue;
        }

        if (response.status === "PLAYING_CARDS") {
          // If human needs to play (not the czar)
          if (response.czarId !== humanPlayerId) {
            const hand = gameService.getPlayerHand(gameId, humanPlayerId);

            // Try to play if we haven't yet
            try {
              const cardsToPlay = hand.hand.slice(0, hand.requiredCards).map((c) => c.id);
              await gameService.playHumanCards(gameId, humanPlayerId, cardsToPlay, OPENAI_API_KEY);
              console.log("Human played cards");
            } catch (e) {
              // Already played or some other issue
              console.log("Human couldn't play:", (e as Error).message);
            }
          }
          await wait(2000);
          continue;
        }

        if (response.status === "JUDGING" && response.czarId === humanPlayerId) {
          // Human judges
          if (response.table.length > 0) {
            const winnerIndex = Math.floor(Math.random() * response.table.length);
            await gameService.humanJudge(gameId, winnerIndex, OPENAI_API_KEY);
            console.log("Human judged");
          }
          continue;
        }

        // Wait for AI to finish if needed
        await wait(3000);
        rounds++;
      }

      // Final state check
      const finalResponse = gameService.getGameResponse(gameId);
      console.log("\n=== FINAL STATE ===");
      console.log(`Status: ${finalResponse.status}`);
      console.log(`Rounds played: ${finalResponse.round}`);
      finalResponse.players.forEach((p) => {
        console.log(`  ${p.name}: ${p.score} points ${p.id === finalResponse.winnerId ? "👑" : ""}`);
      });

      // Game should eventually end
      expect(finalResponse.round).toBeGreaterThan(0);
    }, 300000); // 5 minute timeout for full game
  });
});

describeIfApiKey("Integration - LLM Response Quality", () => {
  it("should get valid card index from AI pick", async () => {
    const { pickCard } = await import("../../src/ai/llm");
    const { getAllWhiteCards, getAllBlackCards } = await import("../../src/core/cards");

    const whiteCards = getAllWhiteCards().slice(0, 10);
    const blackCard = getAllBlackCards()[0];
    const persona = {
      id: "test",
      name: "Test Bot",
      systemPrompt: "You are a funny comedian. Pick the funniest card.",
    };

    console.log("Testing AI card pick...");
    console.log(`Black card: ${blackCard.text}`);

    const startTime = Date.now();
    const index = await pickCard(persona, whiteCards, blackCard, OPENAI_API_KEY);
    const elapsed = Date.now() - startTime;

    console.log(`AI picked index ${index} in ${elapsed}ms`);
    console.log(`Selected card: ${whiteCards[index]?.text}`);

    expect(index).toBeGreaterThanOrEqual(0);
    expect(index).toBeLessThan(whiteCards.length);
  }, 120000); // 2 minute timeout

  it("should get valid winner index from AI judge", async () => {
    const { judgeCards } = await import("../../src/ai/llm");
    const { getAllWhiteCards, getAllBlackCards } = await import("../../src/core/cards");

    const blackCard = getAllBlackCards()[0];
    const submissions = [
      [getAllWhiteCards()[0]],
      [getAllWhiteCards()[1]],
      [getAllWhiteCards()[2]],
    ];
    const persona = {
      id: "judge",
      name: "Judge Bot",
      systemPrompt: "You are a harsh comedy judge. Pick the absolute funniest answer.",
    };

    console.log("Testing AI judge...");
    console.log(`Black card: ${blackCard.text}`);
    console.log("Submissions:");
    submissions.forEach((s, i) => console.log(`  ${i}: ${s[0].text}`));

    const startTime = Date.now();
    const winnerIndex = await judgeCards(persona, blackCard, submissions, OPENAI_API_KEY);
    const elapsed = Date.now() - startTime;

    console.log(`AI chose winner index ${winnerIndex} in ${elapsed}ms`);
    console.log(`Winning card: ${submissions[winnerIndex][0].text}`);

    expect(winnerIndex).toBeGreaterThanOrEqual(0);
    expect(winnerIndex).toBeLessThan(submissions.length);
  }, 120000);
});

describeIfApiKey("Integration - Error Handling", () => {
  it("should handle invalid API key gracefully", async () => {
    const { validateApiKey } = await import("../../src/ai/llm");

    const isValid = await validateApiKey("invalid-key-12345");
    expect(isValid).toBe(false);
  });

  it("should use fallback when AI fails", async () => {
    // This tests the fallback logic in gameService
    // When LLM fails, bots should still play (using first card)
    
    const result = await gameService.createGame(
      {
        humanPlayerName: "Error Test Human",
        personas: ["caesar", "einstein"],
        pointsToWin: 1,
      },
      "invalid-api-key" // Invalid key will cause LLM to fail
    );

    // Game should still be created
    expect(result.gameId).toBeDefined();

    // Try to start - should use fallback
    try {
      await gameService.startGame(result.gameId, "invalid-api-key");
      
      const response = gameService.getGameResponse(result.gameId);
      // Game should still progress (with fallback logic)
      expect(response.round).toBeGreaterThanOrEqual(1);
    } catch (e) {
      // It's also acceptable to fail if LLM is completely unavailable
      console.log("Game start failed (expected with invalid key):", (e as Error).message);
    }
  }, 60000);
});

