import { defineConfig } from "prisma/config";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL must be set for test migrations");
}

let databaseName: string;
try {
  const url = new URL(databaseUrl);
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error();
  }
  databaseName = decodeURIComponent(url.pathname.slice(1));
} catch {
  throw new Error("DATABASE_URL must be a valid PostgreSQL URL");
}

const hasTestMarker = /(?:^|[_-])test(?:$|[_-])/i.test(databaseName);
const hasUnsafeMarker =
  /(?:^|[_-])(?:dev|development|local|prod|production)(?:$|[_-])/i.test(
    databaseName,
  );
const maskedDatabaseName =
  databaseName.length > 1
    ? `${databaseName[0]}${"*".repeat(Math.min(databaseName.length - 1, 8))}`
    : "***";

console.log(
  `Test migration database: ${maskedDatabaseName}; has_test_marker=${hasTestMarker}`,
);

if (!hasTestMarker || hasUnsafeMarker) {
  throw new Error(
    "Refusing migration: DATABASE_URL must target an isolated test database",
  );
}

export default defineConfig({
  schema: "./prisma/schema.prisma",
  datasource: {
    url: databaseUrl,
  },
});
