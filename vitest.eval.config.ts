import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// Live evals that call real APIs. Run with `npm run eval:crisis`; never in CI.
export default defineConfig(({ mode }) => ({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      "server-only": new URL("./test/mocks/server-only.ts", import.meta.url).pathname,
    },
  },
  test: {
    environment: "node",
    globals: false,
    include: ["eval/**/*.eval.ts"],
    env: loadEnv(mode, process.cwd(), ""),
  },
}));
