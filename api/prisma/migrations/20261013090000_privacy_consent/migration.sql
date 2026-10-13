-- AlterTable
ALTER TABLE "users" ADD COLUMN     "privacy_accepted_at" TIMESTAMPTZ(3),
ADD COLUMN     "privacy_accepted_version" TEXT;
