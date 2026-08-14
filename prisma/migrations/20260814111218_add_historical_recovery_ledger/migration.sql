-- CreateTable
CREATE TABLE "historical_recovery_ledger" (
    "id" UUID NOT NULL,
    "recovery_id" TEXT NOT NULL,
    "finding_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "before_value_cents" BIGINT NOT NULL,
    "after_value_cents" BIGINT NOT NULL,
    "approved_by" TEXT,
    "executed_by" TEXT,
    "rolled_back_by" TEXT,
    "rollback_status" TEXT,
    "source_fingerprint" TEXT NOT NULL,
    "evidence" JSONB,
    "error_reason" TEXT,
    "approved_at" TIMESTAMPTZ,
    "executed_at" TIMESTAMPTZ,
    "rolled_back_at" TIMESTAMPTZ,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "historical_recovery_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "historical_recovery_ledger_recovery_id_key" ON "historical_recovery_ledger"("recovery_id");

-- CreateIndex
CREATE INDEX "historical_recovery_ledger_entity_type_entity_id_idx" ON "historical_recovery_ledger"("entity_type", "entity_id");

-- RenameIndex
ALTER INDEX "notifications_user_id_dedupe_key_unique" RENAME TO "notifications_user_id_dedupe_key_key";
