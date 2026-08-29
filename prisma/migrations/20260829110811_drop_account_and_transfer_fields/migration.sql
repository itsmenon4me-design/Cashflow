/*
  Warnings:

  - You are about to drop the column `account_id` on the `Bill` table. All the data in the column will be lost.
  - You are about to drop the column `account_id` on the `investments` table. All the data in the column will be lost.
  - You are about to drop the column `account_id` on the `saving_goals` table. All the data in the column will be lost.
  - You are about to drop the column `account_id` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `attachment_url` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `transfer_group_id` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `transfer_reference` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the `accounts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `historical_recovery_ledger` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Bill" DROP CONSTRAINT "Bill_account_id_fkey";

-- DropForeignKey
ALTER TABLE "accounts" DROP CONSTRAINT "accounts_user_id_fkey";

-- DropForeignKey
ALTER TABLE "investments" DROP CONSTRAINT "investments_account_id_fkey";

-- DropForeignKey
ALTER TABLE "saving_goals" DROP CONSTRAINT "saving_goals_account_id_fkey";

-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_account_id_fkey";

-- DropIndex
DROP INDEX "Bill_account_id_idx";

-- DropIndex
DROP INDEX "investments_account_id_idx";

-- DropIndex
DROP INDEX "saving_goals_account_id_idx";

-- DropIndex
DROP INDEX "transactions_account_id_idx";

-- DropIndex
DROP INDEX "transactions_transfer_group_id_idx";

-- AlterTable
ALTER TABLE "Bill" DROP COLUMN "account_id";

-- AlterTable
ALTER TABLE "investments" DROP COLUMN "account_id";

-- AlterTable
ALTER TABLE "saving_goals" DROP COLUMN "account_id";

-- AlterTable
ALTER TABLE "transactions" DROP COLUMN "account_id",
DROP COLUMN "attachment_url",
DROP COLUMN "transfer_group_id",
DROP COLUMN "transfer_reference";

-- DropTable
DROP TABLE "accounts";

-- DropTable
DROP TABLE "historical_recovery_ledger";
