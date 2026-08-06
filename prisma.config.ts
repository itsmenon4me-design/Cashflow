import { defineConfig } from "prisma/config";
import dotenv from "dotenv";
import path from "path";

dotenv.config({
  path: path.resolve(__dirname, "prisma", ".env"),
});

console.log("DATABASE_URL =", process.env.DATABASE_URL);

export default defineConfig({
  schema: "./prisma/schema.prisma",

  datasource: {
    url: process.env.DATABASE_URL!,
  },

  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});