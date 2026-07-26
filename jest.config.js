export default {
  clearMocks: true,
  transform: {},
  // Upstream's card/render tests need a DOM. Suites that don't (e.g.
  // cache-keys) opt out per-file with `@jest-environment node`.
  testEnvironment: "jsdom",
  coverageProvider: "v8",
  setupFilesAfterEnv: ["<rootDir>/tests/_setup.js"],
  testPathIgnorePatterns: ["<rootDir>/node_modules/", "<rootDir>/tests/e2e/"],
  modulePathIgnorePatterns: ["<rootDir>/node_modules/", "<rootDir>/tests/e2e/"],
  coveragePathIgnorePatterns: [
    "<rootDir>/node_modules/",
    "<rootDir>/tests/E2E/",
  ],
};
