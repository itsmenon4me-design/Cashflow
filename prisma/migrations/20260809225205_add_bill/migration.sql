-- CreateEnum
CREATE TYPE "BillRecurrence" AS ENUM ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY');

-- CreateTable
CREATE TABLE "Bill" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "payee" TEXT NOT NULL,
    "amount_cents" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "account_id" UUID,
    "category_id" UUID,
    "due_date" TIMESTAMP(3) NOT NULL,
    "due_date_timezone" TEXT,
    "is_paid" BOOLEAN NOT NULL DEFAULT false,
    "paid_at" TIMESTAMPTZ,
    "transaction_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "recurrence_type" "BillRecurrence" NOT NULL DEFAULT 'NONE',
    "recurrence_interval" INTEGER,
    "recurrence_ends_at" TIMESTAMP(3),
    "series_id" UUID,
    "is_template" BOOLEAN NOT NULL DEFAULT false,
    "reminder_enabled" BOOLEAN NOT NULL DEFAULT false,
    "reminder_days_before" INTEGER,
    "reminder_time" TEXT,
    "reminder_config" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Bill_user_id_idx" ON "Bill"("user_id");

-- CreateIndex
CREATE INDEX "Bill_user_id_due_date_idx" ON "Bill"("user_id", "due_date");

-- CreateIndex
CREATE INDEX "Bill_user_id_is_paid_idx" ON "Bill"("user_id", "is_paid");

-- CreateIndex
CREATE INDEX "Bill_series_id_idx" ON "Bill"("series_id");

-- CreateIndex
CREATE INDEX "Bill_category_id_idx" ON "Bill"("category_id");

-- CreateIndex
CREATE INDEX "Bill_account_id_idx" ON "Bill"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "Bill_transaction_id_key" ON "Bill"("transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "Bill_series_id_due_date_key" ON "Bill"("series_id", "due_date");

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_account_id_fkey"
FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_category_id_fkey"
FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_transaction_id_fkey"
FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_series_id_fkey"
FOREIGN KEY ("series_id") REFERENCES "Bill"("id") ON DELETE SET NULL ON UPDATE CASCADE;