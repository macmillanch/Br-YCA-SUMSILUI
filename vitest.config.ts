import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    env: {
      BCRYPT_ROUNDS: "4",
      MONGODB_URI: "mongodb://localhost:27017",
      MONGODB_DB: "yca_sumsilui_test",
    },
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
