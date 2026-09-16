import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    // Tests run under plain Node, not Next's "react-server" condition, so
    // the real "server-only" package would throw on import; stub it out.
    alias: {
      "server-only": new URL("./test/mocks/server-only.ts", import.meta.url)
        .pathname,
    },
  },
  test: {
    environment: "node",
    globals: false,
  },
});
