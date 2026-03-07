-- AlterTable
ALTER TABLE "Run" ADD COLUMN IF NOT EXISTS "crossrefSearchResults" JSONB;
ALTER TABLE "Run" ADD COLUMN IF NOT EXISTS "wikipediaSearchResults" JSONB;
ALTER TABLE "Run" ADD COLUMN IF NOT EXISTS "coreSearchResults" JSONB;
