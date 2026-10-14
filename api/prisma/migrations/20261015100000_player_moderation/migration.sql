-- CreateTable
CREATE TABLE "player_bans" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "banned_by" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "previous_status" "user_status" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "expires_at" TIMESTAMPTZ(3),
    "lifted_at" TIMESTAMPTZ(3),
    "lifted_by" UUID,

    CONSTRAINT "player_bans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_notes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "player_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "player_bans_user_id_created_at_idx" ON "player_bans"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "player_bans_lifted_at_expires_at_idx" ON "player_bans"("lifted_at", "expires_at");

-- CreateIndex
CREATE INDEX "player_notes_user_id_created_at_idx" ON "player_notes"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "player_bans" ADD CONSTRAINT "player_bans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_notes" ADD CONSTRAINT "player_notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
