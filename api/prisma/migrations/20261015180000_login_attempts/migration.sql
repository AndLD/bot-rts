-- CreateTable
CREATE TABLE "login_attempts" (
    "id" UUID NOT NULL,
    "at" TIMESTAMPTZ(3) NOT NULL,
    "email" TEXT NOT NULL,
    "user_id" UUID,
    "ip" TEXT,
    "user_agent" TEXT,
    "outcome" TEXT NOT NULL,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "login_attempts_at_idx" ON "login_attempts"("at");

-- CreateIndex
CREATE INDEX "login_attempts_ip_at_idx" ON "login_attempts"("ip", "at");

-- CreateIndex
CREATE INDEX "login_attempts_user_id_at_idx" ON "login_attempts"("user_id", "at");
