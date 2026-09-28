import { assertIsolatedTestDatabase } from "./assert-isolated-test-database";

describe("assertIsolatedTestDatabase", () => {
  it("allows a PostgreSQL database explicitly named for tests", () => {
    expect(() =>
      assertIsolatedTestDatabase(
        "postgresql://user:secret@localhost:55433/cashflow_test?schema=public",
      ),
    ).not.toThrow();
  });

  it.each([
    "postgresql://user:secret@localhost:55433/cashflow?schema=public",
    "postgresql://user:secret@localhost:55433/cashflow_dev?schema=public",
    "postgresql://user:secret@localhost:55433/cashflow_local?schema=public",
    "postgresql://user:secret@localhost:55433/cashflow_prod?schema=public",
  ])("rejects a database not designated for tests", (databaseUrl) => {
    expect(() => assertIsolatedTestDatabase(databaseUrl)).toThrow(
      /isolated database/,
    );
  });

  it("rejects malformed or non-PostgreSQL database URLs", () => {
    expect(() => assertIsolatedTestDatabase("not-a-url")).toThrow(/valid/);
    expect(() =>
      assertIsolatedTestDatabase("mysql://user:secret@localhost/cashflow_test"),
    ).toThrow(/PostgreSQL/);
  });
});
