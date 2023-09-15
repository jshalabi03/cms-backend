/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  coverageThreshold: {
    global: {
      functions: 79,
      lines: 80,
      statements: 80,
    },
  },
  testTimeout: 10000,
  moduleFileExtensions: ["js", "jsx", "json", "ts", "tsx"],
  collectCoverage: false,
  collectCoverageFrom: [
    "**/**/*.ts",
    "!**/node_modules/**",
    "!**/build/**",
    "!**/coverage/**",
    "!build/**",
    "!jest.config.js",
    "!drizzle.config.ts",
    "!**/tests/**",
    "!tests/**",
    "!**/src/db/migrations/**",
  ],
  transform: {
    "^.+\\.(ts|tsx)$": "ts-jest",
  },
  setupFiles: ["<rootDir>/tests/env.ts"],
  coverageReporters: ["text", "text-summary"],
  testRegex: "(/__tests__/.*|(\\.|/)(test|spec))\\.(js|ts)x?$",
  testPathIgnorePatterns: ["/node_modules/", "/build/", "/coverage/", "/dist/"],
  moduleNameMapper: {
    "^routes/(.*)": "<rootDir>src/routes/$1",
    "^db/(.*)": "<rootDir>src/db/$1",
    "^@/(.*)": "<rootDir>src/$1",
  },
  testEnvironment: "node",
};
