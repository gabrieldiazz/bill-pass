/*
  Warnings:

  - You are about to drop the column `relevancy` on the `Bill` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Bill" DROP COLUMN "relevancy",
ADD COLUMN     "bipartisanCosponsors" INTEGER,
ADD COLUMN     "committeeCount" INTEGER,
ADD COLUMN     "introducedAtSessionDay" INTEGER,
ADD COLUMN     "sponsorInMajority" BOOLEAN,
ADD COLUMN     "totalCosponsors" INTEGER;
