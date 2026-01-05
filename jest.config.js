/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
      },
    ],
  },
  setupFilesAfterEnv: ["<rootDir>/test/setup.ts"],
  testMatch: ["**/test/**/*.test.ts"],
  // Long timeout for integration tests with LLM (5 minutes)
  testTimeout: 300000,
  // Verbose output
  verbose: true,
  // Separate test suites
  projects: [
    {
      displayName: "unit",
      preset: "ts-jest/presets/default-esm",
      testEnvironment: "node",
      extensionsToTreatAsEsm: [".ts"],
      moduleNameMapper: {
        "^(\\.{1,2}/.*)\\.js$": "$1",
      },
      transform: {
        "^.+\\.tsx?$": [
          "ts-jest",
          {
            useESM: true,
          },
        ],
      },
      setupFilesAfterEnv: ["<rootDir>/test/setup.ts"],
      testMatch: ["**/test/unit/**/*.test.ts"],
      testTimeout: 30000,
    },
    {
      displayName: "integration",
      preset: "ts-jest/presets/default-esm",
      testEnvironment: "node",
      extensionsToTreatAsEsm: [".ts"],
      moduleNameMapper: {
        "^(\\.{1,2}/.*)\\.js$": "$1",
      },
      transform: {
        "^.+\\.tsx?$": [
          "ts-jest",
          {
            useESM: true,
          },
        ],
      },
      setupFilesAfterEnv: ["<rootDir>/test/setup.ts"],
      testMatch: ["**/test/integration/**/*.test.ts"],
      testTimeout: 300000, // 5 minutes for LLM calls
    },
  ],
};

