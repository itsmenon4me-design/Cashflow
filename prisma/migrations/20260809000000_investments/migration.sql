-- CreateTable
CREATE TABLE "investments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "account_id" UUID,
    "investment_type" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT,
    "quantity" DECIMAL(20,8) NOT NULL,
    "average_buy_price" DECIMAL(20,6) NOT NULL,
    "current_price" DECIMAL(20,6) NOT NULL,
    "invested_amount_cents" BIGINT NOT NULL,
    "current_value_cents" BIGINT NOT NULL,
    "profit_loss_cents" BIGINT NOT NULL,
    "profit_loss_percentage" DECIMAL(10,2) NOT NULL,
    "purchase_date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "investments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "investments_user_id_idx" ON "investments"("user_id");

-- CreateIndex
CREATE INDEX "investments_account_id_idx" ON "investments"("account_id");

-- AddForeignKey
ALTER TABLE "investments" ADD CONSTRAINT "investments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investments" ADD CONSTRAINT "investments_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;