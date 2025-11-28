import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/setup.js"],
    include: ["test/**/*.test.js"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["**/*.js"],
      exclude: [
        "node_modules/**",
        "test/**",
        "*.config.js",
        "dist/**",
        "coverage/**",
        "lib/tesseract.min.js",
        "lib/tesseract-core-simd.wasm.js",
        "lib/worker.min.js"
      ],
    },
  },
});
