const { defineConfig } = require("vitest/config");

module.exports = defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.js"],
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
    pool: "forks",
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
    isolate: false,
    sequence: {
      concurrent: false,
    },
    coverage: {
      reporter: ["text", "lcov"],
      include: ["src/**/*.js"],
      exclude: ["src/server.js", "src/seeder/**", "src/scripts/**"],
    },
  },
});
