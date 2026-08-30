-- Nullable by design: existing rows remain ambiguous until explicitly classified.
ALTER TABLE "users" ADD COLUMN "has_manual_password" BOOLEAN;
