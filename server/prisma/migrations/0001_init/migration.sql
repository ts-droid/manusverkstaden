-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('PROVA', 'GRUND', 'FORLAG');

-- CreateEnum
CREATE TYPE "ChapterStatus" AS ENUM ('PENDING', 'REVIEWING', 'REVIEWED', 'APPROVED');

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PublishType" AS ENUM ('EBOOK', 'AUDIOBOOK', 'PRINT');

-- CreateEnum
CREATE TYPE "PublishStatus" AS ENUM ('DRAFT', 'PENDING_PAYMENT', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "plan" "Plan" NOT NULL DEFAULT 'PROVA',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'sv',
    "targetAudience" TEXT,
    "timePeriod" TEXT,
    "perspective" TEXT,
    "tense" TEXT,
    "tonality" TEXT,
    "genres" TEXT[],
    "modules" TEXT[],
    "transLanguages" TEXT[],
    "dnaProfile" JSONB,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chapter" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "wordCount" INTEGER NOT NULL,
    "status" "ChapterStatus" NOT NULL DEFAULT 'PENDING',
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Suggestion" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "original" TEXT NOT NULL,
    "replacement" TEXT,
    "reason" TEXT NOT NULL,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "chapterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Translation" (
    "id" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "comments" JSONB,
    "glossary" JSONB,
    "chapterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Translation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "wordCount" INTEGER NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL,
    "apiTokensUsed" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanConfig" (
    "id" TEXT NOT NULL,
    "plan" "Plan" NOT NULL,
    "displayName" TEXT NOT NULL,
    "priceMonthly" INTEGER NOT NULL,
    "maxChaptersPerMonth" INTEGER,
    "maxWordsPerReview" INTEGER,
    "includedReviews" INTEGER NOT NULL DEFAULT 0,
    "includedWords" INTEGER NOT NULL DEFAULT 0,
    "features" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "PlanConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishOrder" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "PublishType" NOT NULL,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "config" JSONB NOT NULL,
    "price" DOUBLE PRECISION,
    "stripePaymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublishOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");
CREATE INDEX "Project_userId_idx" ON "Project"("userId");
CREATE INDEX "Chapter_projectId_idx" ON "Chapter"("projectId");
CREATE INDEX "Suggestion_chapterId_idx" ON "Suggestion"("chapterId");
CREATE INDEX "Translation_chapterId_idx" ON "Translation"("chapterId");
CREATE INDEX "UsageRecord_userId_createdAt_idx" ON "UsageRecord"("userId", "createdAt");
CREATE UNIQUE INDEX "PlanConfig_plan_key" ON "PlanConfig"("plan");
CREATE INDEX "PublishOrder_projectId_idx" ON "PublishOrder"("projectId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Translation" ADD CONSTRAINT "Translation_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UsageRecord" ADD CONSTRAINT "UsageRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PublishOrder" ADD CONSTRAINT "PublishOrder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed PlanConfig
INSERT INTO "PlanConfig" ("id", "plan", "displayName", "priceMonthly", "maxChaptersPerMonth", "maxWordsPerReview", "includedReviews", "includedWords", "features") VALUES
  ('plan_prova', 'PROVA', 'Prova', 0, 1, 5000, 1, 5000, '{"review": true, "dna": false, "develop": false, "translate": false}'),
  ('plan_grund', 'GRUND', 'Grund', 99, NULL, NULL, 1, 50000, '{"review": true, "dna": true, "develop": true, "translate": true}'),
  ('plan_forlag', 'FORLAG', 'Förlag', 1500, NULL, NULL, NULL, NULL, '{"review": true, "dna": true, "develop": true, "translate": true, "api": true, "team": true}');
