-- CreateTable
CREATE TABLE "achievement_counters" (
    "user_id" UUID NOT NULL,
    "counter" TEXT NOT NULL,
    "value" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "achievement_counters_pkey" PRIMARY KEY ("user_id","counter")
);

-- CreateTable
CREATE TABLE "achievement_unlocks" (
    "user_id" UUID NOT NULL,
    "achievement_id" TEXT NOT NULL,
    "unlocked_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "achievement_unlocks_pkey" PRIMARY KEY ("user_id","achievement_id")
);

-- AddForeignKey
ALTER TABLE "achievement_counters" ADD CONSTRAINT "achievement_counters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievement_unlocks" ADD CONSTRAINT "achievement_unlocks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
