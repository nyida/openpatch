-- AlterTable
ALTER TABLE "Run" ADD COLUMN IF NOT EXISTS "searxngSearchResults" JSONB;
