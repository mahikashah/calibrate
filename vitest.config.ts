import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // The recommendation engine is pure; no setup files or DB needed.
    globals: false,
  },
});
