import path from "node:path";
import { defineConfig } from "vitest/config";

// Unit tests next to the code they cover. No network, no env file.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
