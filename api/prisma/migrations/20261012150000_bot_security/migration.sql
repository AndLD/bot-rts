-- AlterTable
ALTER TABLE "terminal_sessions" ADD COLUMN "from_bot_id" UUID;

-- CreateTable
CREATE TABLE "bot_access" (
    "bot_id" UUID NOT NULL,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(3),

    CONSTRAINT "bot_access_pkey" PRIMARY KEY ("bot_id")
);

-- AddForeignKey
ALTER TABLE "terminal_sessions" ADD CONSTRAINT "terminal_sessions_from_bot_id_fkey" FOREIGN KEY ("from_bot_id") REFERENCES "bots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_access" ADD CONSTRAINT "bot_access_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
