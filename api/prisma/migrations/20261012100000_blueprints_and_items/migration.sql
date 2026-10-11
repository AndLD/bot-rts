-- CreateEnum
CREATE TYPE "item_type" AS ENUM ('blueprint', 'ammunition', 'part');

-- CreateEnum
CREATE TYPE "blueprint_source" AS ENUM ('research', 'item');

-- CreateTable
CREATE TABLE "items" (
    "id" UUID NOT NULL,
    "type" "item_type" NOT NULL,
    "name" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "bot_id" UUID,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blueprints" (
    "user_id" UUID NOT NULL,
    "module" TEXT NOT NULL,
    "source" "blueprint_source" NOT NULL,
    "learned_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "blueprints_pkey" PRIMARY KEY ("user_id","module")
);

-- CreateIndex
CREATE INDEX "items_bot_id_idx" ON "items"("bot_id");

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "bots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blueprints" ADD CONSTRAINT "blueprints_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

