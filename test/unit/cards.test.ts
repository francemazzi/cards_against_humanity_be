/**
 * Unit Tests for Cards Loader
 * Tests card loading and ID generation
 */

import { getAllWhiteCards, getAllBlackCards, getCardsByPack } from "../../src/core/cards";

describe("Cards Loader - getAllWhiteCards", () => {
  it("should load white cards from base set", () => {
    const cards = getAllWhiteCards();

    expect(cards.length).toBeGreaterThan(0);
    console.log(`Loaded ${cards.length} white cards`);
  });

  it("should assign unique IDs to all cards", () => {
    const cards = getAllWhiteCards();
    const ids = new Set(cards.map((c) => c.id));

    expect(ids.size).toBe(cards.length);
  });

  it("should have required properties on each card", () => {
    const cards = getAllWhiteCards();

    cards.forEach((card) => {
      expect(card).toHaveProperty("id");
      expect(card).toHaveProperty("text");
      expect(card).toHaveProperty("pack");
      expect(typeof card.id).toBe("string");
      expect(typeof card.text).toBe("string");
      expect(typeof card.pack).toBe("number");
    });
  });

  it("should generate stable IDs (same input = same output)", () => {
    const cards1 = getAllWhiteCards();
    const cards2 = getAllWhiteCards();

    // IDs should be the same across calls (caching works)
    expect(cards1[0].id).toBe(cards2[0].id);
    expect(cards1[cards1.length - 1].id).toBe(cards2[cards2.length - 1].id);
  });
});

describe("Cards Loader - getAllBlackCards", () => {
  it("should load black cards from base set", () => {
    const cards = getAllBlackCards();

    expect(cards.length).toBeGreaterThan(0);
    console.log(`Loaded ${cards.length} black cards`);
  });

  it("should assign unique IDs to all cards", () => {
    const cards = getAllBlackCards();
    const ids = new Set(cards.map((c) => c.id));

    expect(ids.size).toBe(cards.length);
  });

  it("should have required properties on each card", () => {
    const cards = getAllBlackCards();

    cards.forEach((card) => {
      expect(card).toHaveProperty("id");
      expect(card).toHaveProperty("text");
      expect(card).toHaveProperty("pack");
      expect(typeof card.id).toBe("string");
      expect(typeof card.text).toBe("string");
      expect(typeof card.pack).toBe("number");
    });
  });

  it("should have pick property (default 1 or specified)", () => {
    const cards = getAllBlackCards();

    cards.forEach((card) => {
      if (card.pick !== undefined) {
        expect(typeof card.pick).toBe("number");
        expect(card.pick).toBeGreaterThanOrEqual(1);
        expect(card.pick).toBeLessThanOrEqual(3);
      }
    });
  });

  it("should include some cards that require multiple picks", () => {
    const cards = getAllBlackCards();
    const multiPickCards = cards.filter((c) => c.pick && c.pick > 1);

    expect(multiPickCards.length).toBeGreaterThan(0);
    console.log(`Found ${multiPickCards.length} cards requiring multiple picks`);
  });
});

describe("Cards Loader - getCardsByPack", () => {
  it("should filter cards by pack ID", () => {
    const pack0 = getCardsByPack(0);

    expect(pack0.white.length).toBeGreaterThan(0);
    expect(pack0.black.length).toBeGreaterThan(0);

    pack0.white.forEach((card) => {
      expect(card.pack).toBe(0);
    });

    pack0.black.forEach((card) => {
      expect(card.pack).toBe(0);
    });
  });

  it("should return empty arrays for non-existent pack", () => {
    const nonExistent = getCardsByPack(99999);

    expect(nonExistent.white).toHaveLength(0);
    expect(nonExistent.black).toHaveLength(0);
  });
});

describe("Cards Loader - Card Content Validation", () => {
  it("should have non-empty text for all white cards", () => {
    const cards = getAllWhiteCards();

    cards.forEach((card) => {
      expect(card.text.trim().length).toBeGreaterThan(0);
    });
  });

  it("should have non-empty text for all black cards", () => {
    const cards = getAllBlackCards();

    cards.forEach((card) => {
      expect(card.text.trim().length).toBeGreaterThan(0);
    });
  });

  it("should have placeholder in most black cards", () => {
    const cards = getAllBlackCards();
    const cardsWithPlaceholder = cards.filter((c) => c.text.includes("_"));

    // Most black cards should have a placeholder (some use "?" format)
    const percentage = (cardsWithPlaceholder.length / cards.length) * 100;
    console.log(`${percentage.toFixed(1)}% of black cards have placeholder`);
    expect(percentage).toBeGreaterThan(70); // Some cards use question format without _
  });
});

describe("Cards Loader - Performance", () => {
  it("should cache loaded decks (second call should be instant)", () => {
    // First call (loads from file)
    const start1 = Date.now();
    getAllWhiteCards();
    const time1 = Date.now() - start1;

    // Second call (should use cache)
    const start2 = Date.now();
    getAllWhiteCards();
    const time2 = Date.now() - start2;

    console.log(`First load: ${time1}ms, Second load: ${time2}ms`);

    // Second call should be much faster (cached)
    expect(time2).toBeLessThanOrEqual(time1);
  });
});

