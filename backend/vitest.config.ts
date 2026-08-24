import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: "./tests/globalSetup.ts",
    setupFiles: ["./tests/env.setup.ts", "./tests/db.setup.ts"],
    testTimeout: 10000,
    pool: "forks",
    fileParallelism: false,
  },
});
