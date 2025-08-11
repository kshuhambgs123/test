/*
  Warnings:

  - Made the column `TotalCreditsBought` on table `User` required. This step will fail if there are existing NULL values in that column.
  - Made the column `TotalCreditsUsed` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Logs" ALTER COLUMN "creditsUsed" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "credits" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "TotalCreditsBought" SET NOT NULL,
ALTER COLUMN "TotalCreditsBought" SET DEFAULT 0,
ALTER COLUMN "TotalCreditsBought" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "TotalCreditsUsed" SET NOT NULL,
ALTER COLUMN "TotalCreditsUsed" SET DEFAULT 0,
ALTER COLUMN "TotalCreditsUsed" SET DATA TYPE DOUBLE PRECISION;
