-- AlterTable
ALTER TABLE "Logs" ADD COLUMN     "email" TEXT,
ADD COLUMN     "name" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "TotalCreditsBought" INTEGER;
