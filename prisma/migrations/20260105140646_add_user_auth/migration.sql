-- Migration: add_user_auth
-- Adds User model for OpenAI API key authentication

-- CreateTable: User
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "openaiKeyHash" TEXT NOT NULL,
    "openaiKeyLast4" TEXT NOT NULL,
    "nickname" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for User
CREATE UNIQUE INDEX "User_openaiKeyHash_key" ON "User"("openaiKeyHash");
CREATE INDEX "User_openaiKeyHash_idx" ON "User"("openaiKeyHash");

-- Create a default system user for existing games (will be used only for migration)
INSERT INTO "User" ("id", "openaiKeyHash", "openaiKeyLast4", "nickname", "createdAt", "updatedAt")
VALUES (
    '00000000-0000-0000-0000-000000000000',
    'legacy_games_system_user_hash_placeholder',
    '0000',
    'Legacy System User',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- AlterTable: Add ownerId to Game as nullable first
ALTER TABLE "Game" ADD COLUMN "ownerId" TEXT;

-- Update existing games to use the system user
UPDATE "Game" SET "ownerId" = '00000000-0000-0000-0000-000000000000' WHERE "ownerId" IS NULL;

-- Make ownerId NOT NULL after migration
ALTER TABLE "Game" ALTER COLUMN "ownerId" SET NOT NULL;

-- AlterTable: Add userId to Player
ALTER TABLE "Player" ADD COLUMN "userId" TEXT;

-- CreateIndex for Game and Player
CREATE INDEX "Game_ownerId_idx" ON "Game"("ownerId");
CREATE INDEX "Player_userId_idx" ON "Player"("userId");

-- AddForeignKey: Game -> User
ALTER TABLE "Game" ADD CONSTRAINT "Game_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Player -> User
ALTER TABLE "Player" ADD CONSTRAINT "Player_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
