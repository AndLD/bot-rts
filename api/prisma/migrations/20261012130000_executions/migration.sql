-- CreateEnum
CREATE TYPE "execution_status" AS ENUM ('active', 'finished', 'killed');

-- CreateTable
CREATE TABLE "executions" (
    "id" UUID NOT NULL,
    "bot_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "file" TEXT NOT NULL,
    "args" JSONB NOT NULL,
    "status" "execution_status" NOT NULL,
    "restarts" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "ended_at" TIMESTAMPTZ(3),

    CONSTRAINT "executions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "executions_status_created_at_idx" ON "executions"("status", "created_at");

-- CreateIndex
CREATE INDEX "executions_user_id_status_idx" ON "executions"("user_id", "status");

-- AddForeignKey
ALTER TABLE "executions" ADD CONSTRAINT "executions_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executions" ADD CONSTRAINT "executions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

