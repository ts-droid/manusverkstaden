-- CreateTable
CREATE TABLE "WordListEntry" (
    "id" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "correction" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "category" TEXT NOT NULL DEFAULT 'general',
    "addedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WordListEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WordListEntry_word_idx" ON "WordListEntry"("word");

-- CreateIndex
CREATE UNIQUE INDEX "WordListEntry_word_correction_key" ON "WordListEntry"("word", "correction");
