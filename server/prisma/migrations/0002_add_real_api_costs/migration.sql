-- AlterTable: Add real API cost tracking fields to UsageRecord
ALTER TABLE "UsageRecord" ADD COLUMN "apiInputTokens" INTEGER;
ALTER TABLE "UsageRecord" ADD COLUMN "apiOutputTokens" INTEGER;
ALTER TABLE "UsageRecord" ADD COLUMN "apiCostUsd" DOUBLE PRECISION;
ALTER TABLE "UsageRecord" ADD COLUMN "model" TEXT;
