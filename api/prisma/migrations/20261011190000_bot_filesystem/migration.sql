-- CreateEnum
CREATE TYPE "file_kind" AS ENUM ('file', 'directory');

-- A file is now identified by its path on the drive
ALTER TABLE "files" RENAME COLUMN "name" TO "path";
ALTER INDEX "files_drive_id_name_key" RENAME TO "files_drive_id_path_key";

-- AlterTable
ALTER TABLE "files" ADD COLUMN "kind" "file_kind" NOT NULL DEFAULT 'file',
ADD COLUMN "content" TEXT NOT NULL DEFAULT '',
ADD COLUMN "size" INTEGER NOT NULL DEFAULT 0;

-- A directory holds nothing; the size is never negative
ALTER TABLE "files" ADD CONSTRAINT "files_content_check" CHECK (
  "size" >= 0 AND ("kind" = 'file' OR ("content" = '' AND "size" = 0))
);
