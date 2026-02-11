// codex: vitest configuration for new unit tests
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    globals: true,
    include: ["tst/**/*.test.ts"],
    setupFiles: ["tst/setup.ts"],
    coverage: {
      provider: "v8",
    },
  },
});
