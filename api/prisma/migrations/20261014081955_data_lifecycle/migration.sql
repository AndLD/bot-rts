-- AlterTable
ALTER TABLE "users" ADD COLUMN     "inactivity_notice_at" TIMESTAMPTZ(3);

-- CreateIndex
CREATE INDEX "executions_ended_at_idx" ON "executions"("ended_at");
