-- CreateTable
CREATE TABLE "saving_goals" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "account_id" UUID,
    "category_id" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "target_amount_cents" BIGINT NOT NULL,
    "current_amount_cents" BIGINT NOT NULL DEFAULT 0,
    "start_date" TIMESTAMP(3) NOT NULL,
    "target_date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "saving_goals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "saving_goals_user_id_idx" ON "saving_goals"("user_id");

-- CreateIndex
CREATE INDEX "saving_goals_account_id_idx" ON "saving_goals"("account_id");

-- CreateIndex
CREATE INDEX "saving_goals_category_id_idx" ON "saving_goals"("category_id");

-- AddForeignKey
ALTER TABLE "saving_goals" ADD CONSTRAINT "saving_goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saving_goals" ADD CONSTRAINT "saving_goals_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saving_goals" ADD CONSTRAINT "saving_goals_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
