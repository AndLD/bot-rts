-- AlterTable
ALTER TABLE "bots" ADD COLUMN     "heading" INTEGER NOT NULL DEFAULT 0;


-- A quarter turn from north, clockwise
ALTER TABLE "bots" ADD CONSTRAINT "bots_heading_check" CHECK ("heading" BETWEEN 0 AND 3);
