const TEST_DATABASE_MARKER = /(?:^|[_-])test(?:$|[_-])/i;
const NON_TEST_DATABASE_MARKER =
  /(?:^|[_-])(?:dev|development|local|prod|production)(?:$|[_-])/i;

export function assertIsolatedTestDatabase(databaseUrl: string): void {
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error("Integration tests require a valid isolated test DATABASE_URL");
  }

  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("Integration tests require a PostgreSQL test database");
  }

  const databaseName = decodeURIComponent(url.pathname.slice(1));
  if (
    !TEST_DATABASE_MARKER.test(databaseName) ||
    NON_TEST_DATABASE_MARKER.test(databaseName)
  ) {
    throw new Error(
      "Refusing integration tests: DATABASE_URL must target an isolated database whose name includes a test marker",
    );
  }
}

// TODO(open issue, unresolved): QA-FLICKER-20260928 rows disappeared between
// browser verification and the guarded cleanup, but no cause was established.
// Keep that data-loss investigation separate; this guard only prevents DB
// integration tests from connecting to a database that is not marked as test.
