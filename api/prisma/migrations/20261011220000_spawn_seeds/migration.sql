-- CreateTable
CREATE TABLE "spawn_seeds" (
    "code" TEXT NOT NULL,
    "anchor_x" INTEGER NOT NULL,
    "anchor_y" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "spawn_seeds_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "spawn_seed_members" (
    "seed_code" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "base_id" UUID NOT NULL,

    CONSTRAINT "spawn_seed_members_pkey" PRIMARY KEY ("seed_code","user_id")
);

-- CreateIndex
CREATE INDEX "spawn_seed_members_base_id_idx" ON "spawn_seed_members"("base_id");

-- AddForeignKey
ALTER TABLE "spawn_seed_members" ADD CONSTRAINT "spawn_seed_members_seed_code_fkey" FOREIGN KEY ("seed_code") REFERENCES "spawn_seeds"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spawn_seed_members" ADD CONSTRAINT "spawn_seed_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spawn_seed_members" ADD CONSTRAINT "spawn_seed_members_base_id_fkey" FOREIGN KEY ("base_id") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The bases on the map, corpse bases too, for the distance rule of the base spawn (design §4.1)
DROP INDEX "map_points_base_idx";
CREATE INDEX "map_points_base_idx" ON "map_points"("x", "y") WHERE "type" IN ('base', 'corpse_base');
