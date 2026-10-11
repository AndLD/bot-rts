-- CreateEnum
CREATE TYPE "terminal_log_kind" AS ENUM ('input', 'output', 'error', 'security');

-- CreateTable
CREATE TABLE "terminal_sessions" (
    "id" UUID NOT NULL,
    "bot_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "started_at" TIMESTAMPTZ(3) NOT NULL,
    "ended_at" TIMESTAMPTZ(3),

    CONSTRAINT "terminal_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "terminal_logs" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "bot_id" UUID NOT NULL,
    "at" TIMESTAMPTZ(3) NOT NULL,
    "kind" "terminal_log_kind" NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "terminal_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "terminal_sessions_bot_id_started_at_idx" ON "terminal_sessions"("bot_id", "started_at");

-- CreateIndex
CREATE INDEX "terminal_sessions_user_id_idx" ON "terminal_sessions"("user_id");

-- CreateIndex
CREATE INDEX "terminal_logs_bot_id_at_idx" ON "terminal_logs"("bot_id", "at");

-- CreateIndex
CREATE INDEX "terminal_logs_at_idx" ON "terminal_logs"("at");

-- AddForeignKey
ALTER TABLE "terminal_sessions" ADD CONSTRAINT "terminal_sessions_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terminal_sessions" ADD CONSTRAINT "terminal_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terminal_logs" ADD CONSTRAINT "terminal_logs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "terminal_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terminal_logs" ADD CONSTRAINT "terminal_logs_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
