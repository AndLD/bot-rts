-- A corpse base holds its base like a living one does
ALTER TABLE "map_points" DROP CONSTRAINT "map_points_content_check";
ALTER TABLE "map_points" ADD CONSTRAINT "map_points_content_check" CHECK (
  COALESCE("type" IN ('bot', 'base', 'corpse_base', 'item'), false) = ("content_id" IS NOT NULL)
);
