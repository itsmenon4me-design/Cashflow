-- Add dedupe_key column to notifications and a unique index on (user_id, dedupe_key)
ALTER TABLE "notifications"
ADD COLUMN IF NOT EXISTS "dedupe_key" TEXT;

-- Add unique index to prevent duplicates per user for non-null dedupe_key
CREATE UNIQUE INDEX IF NOT EXISTS "notifications_user_id_dedupe_key_unique" ON "notifications" ("user_id", "dedupe_key");
