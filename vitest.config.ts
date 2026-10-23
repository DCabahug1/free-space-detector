import path from "node:path";
import { defineConfig } from "vitest/config";

// Backend tests for the API route handlers in src/app/api.
// They call the handlers directly with a fake Supabase client, so no
// network, no env file and no writes to the real database.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["src/app/api/__tests__/**/*.test.ts"],
  },
});
