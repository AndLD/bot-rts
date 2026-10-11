-- AlterTable
ALTER TABLE "bots" ADD COLUMN     "last_x" INTEGER,
ADD COLUMN     "last_y" INTEGER,
ADD COLUMN     "last_z" INTEGER;

-- The last position is all three coordinates or none
ALTER TABLE "bots" ADD CONSTRAINT "bots_last_position_check" CHECK (
  ("last_x" IS NULL) = ("last_y" IS NULL) AND ("last_y" IS NULL) = ("last_z" IS NULL)
);
