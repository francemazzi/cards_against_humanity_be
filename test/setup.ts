/**
 * Test Setup File
 * Loaded before each test suite
 */

import "dotenv/config";
import prisma from "../src/db/prisma";

// Log test environment info
beforeAll(() => {
  console.log("\n📋 Test Environment:");
  console.log(`  Node: ${process.version}`);
  console.log(`  OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? "✅ Set" : "❌ Not set"}`);
  console.log("");
});

// Cleanup after all tests - disconnect Prisma to avoid Jest hanging
afterAll(async () => {
  console.log("\n✅ Tests completed");
  await prisma.$disconnect();
});
