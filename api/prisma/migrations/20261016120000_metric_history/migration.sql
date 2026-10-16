-- CreateTable
CREATE TABLE "metric_minutes" (
    "node" TEXT NOT NULL,
    "minute" TIMESTAMPTZ(3) NOT NULL,
    "metric" TEXT NOT NULL,
    "sum" DOUBLE PRECISION NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "metric_minutes_pkey" PRIMARY KEY ("node","minute","metric")
);

-- CreateTable
CREATE TABLE "histogram_minutes" (
    "node" TEXT NOT NULL,
    "minute" TIMESTAMPTZ(3) NOT NULL,
    "histogram" TEXT NOT NULL,
    "counts" INTEGER[],
    "slowest_ms" DOUBLE PRECISION,
    "slowest_trace_id" TEXT,

    CONSTRAINT "histogram_minutes_pkey" PRIMARY KEY ("node","minute","histogram")
);

-- CreateIndex
CREATE INDEX "metric_minutes_minute_idx" ON "metric_minutes"("minute");

-- CreateIndex
CREATE INDEX "histogram_minutes_minute_idx" ON "histogram_minutes"("minute");
