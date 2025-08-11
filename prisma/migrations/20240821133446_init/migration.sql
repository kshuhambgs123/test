/*
  Warnings:

  - You are about to drop the `ApiKeys` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_UserID_fkey";

-- DropTable
DROP TABLE "ApiKeys";
