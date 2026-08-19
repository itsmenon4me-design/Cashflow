import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "./prisma/schema.prisma",

  datasource: {
    url: "postgresql://postgres:postgres@localhost:5432/cashflow_test?schema=public",
  },

  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});