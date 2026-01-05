// Cards loader - loads and manages the card deck
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { BlackCard, WhiteCard } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Raw card types from JSON (without id)
interface RawWhiteCard {
  text: string;
  pack: number;
}

interface RawBlackCard {
  text: string;
  pick?: number;
  pack: number;
}

interface DeckData {
  name: string;
  white: RawWhiteCard[];
  black: RawBlackCard[];
  official: boolean;
}

let cachedDecks: DeckData[] | null = null;

function loadDecks(): DeckData[] {
  if (cachedDecks) return cachedDecks;

  const deckPath = path.join(__dirname, "../../cards/cardsDeks.json");
  const raw = fs.readFileSync(deckPath, "utf-8");
  cachedDecks = JSON.parse(raw) as DeckData[];
  return cachedDecks;
}

/**
 * Get all white cards from the base set, with unique IDs
 */
export function getAllWhiteCards(): WhiteCard[] {
  const decks = loadDecks();
  const baseSet = decks.find((d) => d.name === "CAH Base Set");

  if (!baseSet) {
    throw new Error("Base set not found");
  }

  return baseSet.white.map((card, index) => ({
    ...card,
    id: `white_${index}_${hashText(card.text)}`,
  }));
}

/**
 * Get all black cards from the base set, with unique IDs
 */
export function getAllBlackCards(): BlackCard[] {
  const decks = loadDecks();
  const baseSet = decks.find((d) => d.name === "CAH Base Set");

  if (!baseSet) {
    throw new Error("Base set not found");
  }

  return baseSet.black.map((card, index) => ({
    ...card,
    id: `black_${index}_${hashText(card.text)}`,
  }));
}

/**
 * Get cards from specific packs
 */
export function getCardsByPack(packId: number): {
  white: WhiteCard[];
  black: BlackCard[];
} {
  const decks = loadDecks();
  const allWhite: WhiteCard[] = [];
  const allBlack: BlackCard[] = [];

  let whiteIndex = 0;
  let blackIndex = 0;

  for (const deck of decks) {
    for (const card of deck.white) {
      if (card.pack === packId) {
        allWhite.push({
          ...card,
          id: `white_${whiteIndex}_${hashText(card.text)}`,
        });
      }
      whiteIndex++;
    }

    for (const card of deck.black) {
      if (card.pack === packId) {
        allBlack.push({
          ...card,
          id: `black_${blackIndex}_${hashText(card.text)}`,
        });
      }
      blackIndex++;
    }
  }

  return { white: allWhite, black: allBlack };
}

/**
 * Simple hash for creating stable IDs
 */
function hashText(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).substring(0, 8);
}
