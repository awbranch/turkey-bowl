import { defineConfig } from "drizzle-kit";

// Generates SQL migrations into ./drizzle; apply them with `pnpm db:migrate:local|remote` (wrangler).
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
});
