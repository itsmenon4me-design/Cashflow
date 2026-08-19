-- Soft-delete account name uniqueness (P0 gap closure)
--
-- Replaces the full UNIQUE(user_id, name) index (accounts_user_id_name_key,
-- created by 20260806044513_init) with a PARTIAL unique index that enforces
-- name uniqueness only among ACTIVE accounts (deleted_at IS NULL).
--
-- Before this migration, soft-deleting an account ("BCA") permanently blocked
-- recreating an account named "BCA" because the full unique index still saw the
-- soft-deleted row. After this migration, the name can be reused once the
-- previous row is soft-deleted, while active duplicates remain impossible.
--
-- NOTE FOR PRISMA USERS
-- Prisma cannot represent partial indexes in schema.prisma. This index
-- intentionally has no schema counterpart (the old @@unique([user_id, name])
-- was removed from schema.prisma in the same change set). Do NOT run
-- `prisma migrate dev` against a database where this migration is applied --
-- it would propose dropping this index as "drift". Use `prisma migrate deploy`
-- (replays migrations without schema diffing) or `prisma migrate resolve`.

-- Drop the old full unique constraint (blocks reuse after soft delete).
DROP INDEX IF EXISTS "accounts_user_id_name_key";

-- Enforce uniqueness only among active (not soft-deleted) accounts.
CREATE UNIQUE INDEX "accounts_user_id_name_active_key"
  ON "accounts"("user_id", "name")
  WHERE "deleted_at" IS NULL;