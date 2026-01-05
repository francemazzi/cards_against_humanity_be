// OpenAI integration for AI players
// Supports user-provided API keys (production) or env fallback (dev)
import OpenAI from "openai";
import type { BlackCard, WhiteCard, Persona } from "../core/types.js";

// Get dev API key from env (optional fallback)
const DEV_API_KEY = process.env.OPENAI_API_KEY;

/**
 * Create OpenAI client with user's API key
 * Falls back to env key in dev mode if not provided
 */
function createClient(userApiKey?: string): OpenAI {
  const apiKey = userApiKey || DEV_API_KEY;
  
  if (!apiKey) {
    throw new Error("OpenAI API key is required. Provide via X-OpenAI-Key header.");
  }
  
  return new OpenAI({ 
      apiKey,
      timeout: 10000 // 10 seconds timeout
  });
}

/**
 * Ask an AI agent to pick a card from their hand
 */
export async function pickCard(
  persona: Persona,
  hand: WhiteCard[],
  blackCard: BlackCard,
  userApiKey?: string
): Promise<number> {
  const openai = createClient(userApiKey);
  const prompt = buildPickCardPrompt(hand, blackCard);

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: persona.systemPrompt },
      { role: "user", content: prompt },
    ],
    temperature: 0.9,
    max_tokens: 10,
  });

  const answer = response.choices[0]?.message?.content?.trim() || "0";
  const index = parseInt(answer, 10);

  // Validate index
  if (isNaN(index) || index < 0 || index >= hand.length) {
    console.warn(`AI returned invalid index "${answer}", defaulting to 0`);
    return 0;
  }

  return index;
}

/**
 * Ask an AI agent (as Czar) to judge the winner
 */
export async function judgeCards(
  persona: Persona,
  blackCard: BlackCard,
  submissions: WhiteCard[][],
  userApiKey?: string
): Promise<number> {
  const openai = createClient(userApiKey);
  const prompt = buildJudgePrompt(blackCard, submissions);

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: persona.systemPrompt },
      { role: "user", content: prompt },
    ],
    temperature: 0.9,
    max_tokens: 10,
  });

  const answer = response.choices[0]?.message?.content?.trim() || "0";
  const index = parseInt(answer, 10);

  // Validate index
  if (isNaN(index) || index < 0 || index >= submissions.length) {
    console.warn(`AI Czar returned invalid index "${answer}", defaulting to 0`);
    return 0;
  }

  return index;
}

/**
 * Validate an API key by making a minimal request
 */
export async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    const openai = new OpenAI({ apiKey });
    await openai.models.list();
    return true;
  } catch {
    return false;
  }
}

// --- Prompt Builders ---

function buildPickCardPrompt(hand: WhiteCard[], blackCard: BlackCard): string {
  const cardsRequired = blackCard.pick || 1;

  let prompt = `You are playing Cards Against Humanity.\n\n`;
  prompt += `The BLACK CARD is: "${blackCard.text}"\n`;
  prompt += `(This card requires ${cardsRequired} white card${cardsRequired > 1 ? "s" : ""} to complete)\n\n`;
  prompt += `Your HAND:\n`;

  hand.forEach((card, i) => {
    prompt += `${i}: "${card.text}"\n`;
  });

  prompt += `\nPick the card that would be the FUNNIEST answer based on your personality.\n`;
  prompt += `Respond with ONLY the index number (0-${hand.length - 1}). No explanation.`;

  return prompt;
}

function buildJudgePrompt(
  blackCard: BlackCard,
  submissions: WhiteCard[][]
): string {
  let prompt = `You are the Card Czar in Cards Against Humanity.\n\n`;
  prompt += `The BLACK CARD is: "${blackCard.text}"\n\n`;
  prompt += `The SUBMISSIONS are:\n`;

  submissions.forEach((cards, i) => {
    const combined = cards.map((c) => c.text).join(" + ");
    prompt += `${i}: ${combined}\n`;
  });

  prompt += `\nPick the FUNNIEST submission based on your personality and sense of humor.\n`;
  prompt += `Respond with ONLY the index number (0-${submissions.length - 1}). No explanation.`;

  return prompt;
}
