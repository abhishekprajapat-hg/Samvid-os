import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.{test,spec}.{js,jsx}"],
    setupFiles: ["./src/test/setup.js"],
    css: true,
    testTimeout: 20000,
    hookTimeout: 20000,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.{js,jsx}"],
      exclude: ["src/main.jsx", "src/test/**"],
      thresholds: {
        statements: 1.38,
        branches: 0.52,
        functions: 1.17,
        lines: 1.49,
        "src/services/api.js": {
          statements: 91.89,
          branches: 63.41,
          functions: 93.33,
          lines: 91.81,
        },
        "src/components/auth/Login.jsx": {
          statements: 77.14,
          branches: 46.15,
          functions: 100,
          lines: 77.14,
        },
        "src/components/workbench/workbenchNavigation.js": {
          statements: 56.71,
          branches: 35.71,
          functions: 51.72,
          lines: 58.33,
        },
      },
    },
  },
});
