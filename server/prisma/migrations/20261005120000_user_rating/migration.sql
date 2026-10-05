-- AlterTable
ALTER TABLE "users" ADD COLUMN     "rating" INTEGER NOT NULL DEFAULT 1500;

-- CreateIndex
CREATE INDEX "users_rating_idx" ON "users"("rating");

