import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: "./tests/globalSetup.ts",
    setupFiles: ["./tests/env.setup.ts", "./tests/db.setup.ts"],
    testTimeout: 10000,
    // All test files share one sqlite test.db. Run them in a single process,
    // one file at a time (no parallelism), to avoid SQLite file-lock
    // contention/EBUSY errors between test files hitting the same db file.
    pool: "forks",
    fileParallelism: false,
  },
});
