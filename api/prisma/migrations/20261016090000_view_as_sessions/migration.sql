-- "View as player": a session of an admin that shows another player's game in read-only mode
ALTER TABLE "sessions" ADD COLUMN "view_as_user_id" UUID,
ADD COLUMN "view_as_reason" TEXT;
