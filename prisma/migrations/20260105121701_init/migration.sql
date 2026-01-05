-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('LOBBY', 'PLAYING_CARDS', 'JUDGING', 'ROUND_ENDED', 'GAME_OVER');

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "status" "GameStatus" NOT NULL DEFAULT 'LOBBY',
    "round" INTEGER NOT NULL DEFAULT 0,
    "czarIndex" INTEGER NOT NULL DEFAULT 0,
    "pointsToWin" INTEGER NOT NULL DEFAULT 7,
    "maxPlayers" INTEGER NOT NULL DEFAULT 8,
    "currentBlackCard" JSONB,
    "deckBlackIds" TEXT[],
    "deckWhiteIds" TEXT[],
    "winnerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isBot" BOOLEAN NOT NULL DEFAULT false,
    "score" INTEGER NOT NULL DEFAULT 0,
    "hand" JSONB[],
    "personaId" TEXT,
    "personaName" TEXT,
    "systemPrompt" TEXT,
    "gameId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayedCard" (
    "id" TEXT NOT NULL,
    "cards" JSONB[],
    "playerId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayedCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Persona" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Persona_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Game_status_idx" ON "Game"("status");

-- CreateIndex
CREATE INDEX "Player_gameId_idx" ON "Player"("gameId");

-- CreateIndex
CREATE INDEX "PlayedCard_gameId_round_idx" ON "PlayedCard"("gameId", "round");

-- CreateIndex
CREATE UNIQUE INDEX "Persona_name_key" ON "Persona"("name");

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayedCard" ADD CONSTRAINT "PlayedCard_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayedCard" ADD CONSTRAINT "PlayedCard_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
