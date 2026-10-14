-- CreateTable
CREATE TABLE "balance_versions" (
    "version" SERIAL NOT NULL,
    "document" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "balance_versions_pkey" PRIMARY KEY ("version")
);
