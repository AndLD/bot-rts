-- DropIndex
DROP INDEX "bots_user_id_idx";

-- DropIndex
DROP INDEX "modules_bot_id_idx";

-- CreateIndex
CREATE INDEX "bots_user_id_type_idx" ON "bots"("user_id", "type");

-- CreateIndex
CREATE INDEX "modules_bot_id_type_idx" ON "modules"("bot_id", "type");

-- The bases on the map, for the minimum-distance rule of the base spawn (design §4.1)
CREATE INDEX "map_points_base_idx" ON "map_points"("x", "y") WHERE "type" = 'base';

-- (NULL-safe: a NULL type must not make a CHECK evaluate to NULL, which would pass)
-- A deposit is a resource cell with a positive amount; any other cell holds none (design §9.1)
ALTER TABLE "map_points" ADD CONSTRAINT "map_points_deposit_check" CHECK (
  ("resource" IS NULL AND "amount" IS NULL)
  OR ("resource" IS NOT NULL AND "amount" > 0 AND "type" IS NOT DISTINCT FROM 'resource')
);

ALTER TABLE "known_points" ADD CONSTRAINT "known_points_deposit_check" CHECK (
  ("resource" IS NULL AND "amount" IS NULL)
  OR ("resource" IS NOT NULL AND "amount" > 0 AND "type" IS NOT DISTINCT FROM 'resource')
);

-- Cells holding a bot, a base or an item point at that content
ALTER TABLE "map_points" ADD CONSTRAINT "map_points_content_check" CHECK (
  COALESCE("type" IN ('bot', 'base', 'item'), false) = ("content_id" IS NOT NULL)
);
