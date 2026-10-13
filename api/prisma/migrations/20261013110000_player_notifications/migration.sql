-- AlterTable
ALTER TABLE "user_settings" ADD COLUMN     "notification_categories" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "player_notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "params" JSONB NOT NULL DEFAULT '{}',
    "bot_id" TEXT,
    "count" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "delivered_at" TIMESTAMPTZ(3),
    "read_at" TIMESTAMPTZ(3),

    CONSTRAINT "player_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "player_notifications_user_id_created_at_idx" ON "player_notifications"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "player_notifications_delivered_at_created_at_idx" ON "player_notifications"("delivered_at", "created_at");

-- AddForeignKey
ALTER TABLE "player_notifications" ADD CONSTRAINT "player_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

