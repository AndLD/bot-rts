-- AlterTable
ALTER TABLE "bots" ADD COLUMN "password_hash" TEXT;

-- Every base has an access password (design §11.2.2). NOT VALID: bases created before this migration are not checked.
ALTER TABLE "bots" ADD CONSTRAINT "bots_base_password_check" CHECK ("type" <> 'base' OR "password_hash" IS NOT NULL) NOT VALID;
