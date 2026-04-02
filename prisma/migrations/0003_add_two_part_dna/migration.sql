-- AlterTable: Add cumulative author DNA to User
ALTER TABLE "User" ADD COLUMN "authorDna" JSONB;
ALTER TABLE "User" ADD COLUMN "authorDnaVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: Add story-specific DNA to Project
ALTER TABLE "Project" ADD COLUMN "storyDna" JSONB;
