# Soft-Delete Name Uniqueness (Application-Level Requirement)

Status: Documented requirement — unrelated uniqueness migrations remain blocked
by the P0 constraint.

## Requirement

For soft-deleted entities, the business rule is that a user must be able to recreate an
entity with the same user-scoped name/identity key after the previous row was soft-deleted
(`deleted_at` set, row retained for audit/history).

Affected identity keys per entity:

- Accounts: `(user_id, name)` — DB has `@@unique([user_id, name])`.
- Categories: `(user_id, name, type)` — DB has `@@unique([user_id, name, type])`.
- Budgets: `(user_id, category_id, month, year)` — NO DB unique constraint.
- Saving goals: `(user_id, name)` — NO DB unique constraint.
- Investments: `(user_id, name)` — NO DB unique constraint.

## Current state (documented, not changed)

- **Accounts (P0 gap — migration PREPARED, NOT APPLIED):** the migration
  `prisma/migrations/20260817000000_soft_delete_account_name_uniqueness` replaces the
  full `accounts_user_id_name_key` unique index with a partial unique index
  `accounts_user_id_name_active_key ON accounts(user_id, name) WHERE deleted_at IS NULL`.
  Until that migration is applied, the old full constraint still blocks name reuse.
- **Categories:** the plain unique constraint ignores `deleted_at`, so after a
  soft delete the constraint still blocks recreation until a **partial unique
  index** exists.
- **Budgets/Saving goals/Investments:** there is no DB unique constraint at all;
  uniqueness is enforced only by application-level checks
  (`findByUserAndCategoryAndPeriod`, name lookups before create). Concurrent creates can
  still slip through.
- The Neon production database has the `20261004200000_add_session_device_id`
  schema change applied manually: `sessions.device_id` and its supporting index
  were added to fix native login. This is unrelated to the uniqueness migrations
  above. Reconcile this migration in Prisma's production migration history with
  `prisma migrate resolve --applied 20261004200000_add_session_device_id` before
  the next production `prisma migrate deploy`; first verify production migration
  status and target as described in `docs/DEPLOYMENT.md`.
- The accounts migration above remains deliberately NOT applied. The P0
  constraint continues to prohibit unrelated schema migrations.
- The integration test `accounts.integration.spec.ts` covers: active duplicate names
  rejected, soft-deleted name reuse (requires the prepared migration to be applied),
  IDR/USD/SGD/EUR isolation, and cross-user access rejection.

## Recommended future change (when a migration is permitted)

Apply the prepared accounts migration and the following partial unique indexes for the
remaining entities:

```sql
-- accounts (already prepared in 20260817000000_soft_delete_account_name_uniqueness)
CREATE UNIQUE INDEX "accounts_user_id_name_active_idx"
  ON "accounts" ("user_id", "name") WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX "categories_user_name_type_active_idx"
  ON "categories" ("user_id", "name", "type") WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX "budgets_user_cat_period_active_idx"
  ON "budgets" ("user_id", "category_id", "month", "year") WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX "saving_goals_user_name_active_idx"
  ON "saving_goals" ("user_id", "name") WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX "investments_user_name_active_idx"
  ON "investments" ("user_id", "name") WHERE deleted_at IS NULL;
```

This is deliberately NOT applied in this P0 pass: the hardening work must not create,
modify, or apply any database migration.