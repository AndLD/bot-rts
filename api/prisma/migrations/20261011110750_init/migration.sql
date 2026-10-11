-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('admin', 'owner', 'user', 'unlimited', 'banned');

-- CreateEnum
CREATE TYPE "subscription" AS ENUM ('free', 'monthly', 'yearly');

-- CreateEnum
CREATE TYPE "bot_type" AS ENUM ('base', 'worker');

-- CreateEnum
CREATE TYPE "map_point_type" AS ENUM ('resource', 'bot', 'item', 'base');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "status" "user_status" NOT NULL DEFAULT 'user',
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "subscription" "subscription" NOT NULL DEFAULT 'free',
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bots" (
    "id" UUID NOT NULL,
    "label" TEXT,
    "type" "bot_type" NOT NULL,
    "user_id" UUID,
    "base_id" UUID,

    CONSTRAINT "bots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modules" (
    "id" UUID NOT NULL,
    "bot_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "condition" DOUBLE PRECISION NOT NULL,
    "max_condition" DOUBLE PRECISION NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "operation_cost" DOUBLE PRECISION NOT NULL,
    "idle_cost" DOUBLE PRECISION NOT NULL,
    "props" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" UUID NOT NULL,
    "drive_id" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "map_points" (
    "id" UUID NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "z" INTEGER NOT NULL DEFAULT 0,
    "type" "map_point_type",
    "content_id" UUID,

    CONSTRAINT "map_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "known_points" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "z" INTEGER NOT NULL DEFAULT 0,
    "type" "map_point_type",
    "content_id" UUID,
    "seen_at" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "known_points_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at");

-- CreateIndex
CREATE INDEX "bots_user_id_idx" ON "bots"("user_id");

-- CreateIndex
CREATE INDEX "bots_base_id_idx" ON "bots"("base_id");

-- CreateIndex
CREATE INDEX "modules_bot_id_idx" ON "modules"("bot_id");

-- CreateIndex
CREATE UNIQUE INDEX "files_drive_id_name_key" ON "files"("drive_id", "name");

-- CreateIndex
CREATE INDEX "map_points_content_id_idx" ON "map_points"("content_id");

-- CreateIndex
CREATE UNIQUE INDEX "map_points_x_y_z_key" ON "map_points"("x", "y", "z");

-- CreateIndex
CREATE UNIQUE INDEX "known_points_user_id_x_y_z_key" ON "known_points"("user_id", "x", "y", "z");

-- AddForeignKey
ALTER TABLE "bots" ADD CONSTRAINT "bots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bots" ADD CONSTRAINT "bots_base_id_fkey" FOREIGN KEY ("base_id") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modules" ADD CONSTRAINT "modules_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_drive_id_fkey" FOREIGN KEY ("drive_id") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "known_points" ADD CONSTRAINT "known_points_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Ownership model of design §8.1: a base belongs to a user and has no base; any other bot belongs to a base only
ALTER TABLE "bots" ADD CONSTRAINT "bots_ownership_check" CHECK (
  ("type" = 'base' AND "user_id" IS NOT NULL AND "base_id" IS NULL)
  OR ("type" <> 'base' AND "user_id" IS NULL AND "base_id" IS NOT NULL)
);
