-- CreateTable
CREATE TABLE "player_activity" (
    "user_id" UUID NOT NULL,
    "day" DATE NOT NULL,

    CONSTRAINT "player_activity_pkey" PRIMARY KEY ("user_id","day")
);

-- CreateIndex
CREATE INDEX "player_activity_day_idx" ON "player_activity"("day");

-- AddForeignKey
ALTER TABLE "player_activity" ADD CONSTRAINT "player_activity_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
