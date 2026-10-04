ALTER TABLE "sessions" ADD COLUMN "device_id" TEXT;

CREATE INDEX "sessions_user_id_device_id_idx" ON "sessions"("user_id", "device_id");
