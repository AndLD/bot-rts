-- CreateEnum
CREATE TYPE "resource_type" AS ENUM ('iron', 'stone', 'wood', 'oil', 'crystal', 'gold');

-- AlterTable
ALTER TABLE "known_points" ADD COLUMN     "amount" INTEGER,
ADD COLUMN     "resource" "resource_type";

-- AlterTable
ALTER TABLE "map_points" ADD COLUMN     "amount" INTEGER,
ADD COLUMN     "resource" "resource_type";
