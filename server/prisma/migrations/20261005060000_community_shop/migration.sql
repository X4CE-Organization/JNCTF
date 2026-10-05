-- AlterTable
ALTER TABLE "users" ADD COLUMN     "points" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "moments" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "content" VARCHAR(2000) NOT NULL,
    "images" VARCHAR(2000) NOT NULL DEFAULT '[]',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "comment_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "moments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moment_likes" (
    "moment_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moment_likes_pkey" PRIMARY KEY ("moment_id","user_id")
);

-- CreateTable
CREATE TABLE "moment_comments" (
    "id" BIGSERIAL NOT NULL,
    "moment_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "content" VARCHAR(1000) NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moment_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discussions" (
    "id" BIGSERIAL NOT NULL,
    "board" VARCHAR(32) NOT NULL DEFAULT 'general',
    "title" VARCHAR(200) NOT NULL,
    "content" TEXT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "views" INTEGER NOT NULL DEFAULT 0,
    "reply_count" INTEGER NOT NULL DEFAULT 0,
    "last_reply_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discussions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discussion_replies" (
    "id" BIGSERIAL NOT NULL,
    "discussion_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "content" TEXT NOT NULL,
    "floor" INTEGER NOT NULL DEFAULT 1,
    "reply_to_id" BIGINT,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discussion_replies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "articles" (
    "id" BIGSERIAL NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "summary" VARCHAR(500) NOT NULL DEFAULT '',
    "content" TEXT NOT NULL,
    "cover" VARCHAR(512),
    "category" VARCHAR(32) NOT NULL DEFAULT '综合',
    "user_id" BIGINT NOT NULL,
    "state" VARCHAR(16) NOT NULL DEFAULT 'APPROVED',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "views" INTEGER NOT NULL DEFAULT 0,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_comments" (
    "id" BIGSERIAL NOT NULL,
    "article_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "content" VARCHAR(1000) NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_items" (
    "id" BIGSERIAL NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "description" VARCHAR(500) NOT NULL DEFAULT '',
    "icon" VARCHAR(32) NOT NULL DEFAULT 'package',
    "price" INTEGER NOT NULL DEFAULT 100,
    "kind" VARCHAR(16) NOT NULL,
    "grant_amount" INTEGER NOT NULL DEFAULT 1,
    "stock" INTEGER NOT NULL DEFAULT -1,
    "max_per_user" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_orders" (
    "id" BIGSERIAL NOT NULL,
    "order_no" VARCHAR(32) NOT NULL,
    "user_id" BIGINT NOT NULL,
    "item_id" BIGINT,
    "item_name" VARCHAR(80) NOT NULL,
    "kind" VARCHAR(16) NOT NULL,
    "price" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(16) NOT NULL DEFAULT 'PAID',
    "note" VARCHAR(500) NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shop_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grants" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "kind" VARCHAR(16) NOT NULL,
    "total" INTEGER NOT NULL DEFAULT 1,
    "used" INTEGER NOT NULL DEFAULT 0,
    "order_id" BIGINT,
    "note" VARCHAR(200) NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "moments_hidden_pinned_id_idx" ON "moments"("hidden", "pinned", "id");

-- CreateIndex
CREATE INDEX "moments_user_id_hidden_id_idx" ON "moments"("user_id", "hidden", "id");

-- CreateIndex
CREATE INDEX "moment_comments_moment_id_hidden_id_idx" ON "moment_comments"("moment_id", "hidden", "id");

-- CreateIndex
CREATE INDEX "discussions_hidden_pinned_id_idx" ON "discussions"("hidden", "pinned", "id");

-- CreateIndex
CREATE INDEX "discussions_board_hidden_id_idx" ON "discussions"("board", "hidden", "id");

-- CreateIndex
CREATE INDEX "discussion_replies_discussion_id_hidden_id_idx" ON "discussion_replies"("discussion_id", "hidden", "id");

-- CreateIndex
CREATE INDEX "articles_hidden_pinned_id_idx" ON "articles"("hidden", "pinned", "id");

-- CreateIndex
CREATE INDEX "articles_state_hidden_id_idx" ON "articles"("state", "hidden", "id");

-- CreateIndex
CREATE INDEX "article_comments_article_id_hidden_id_idx" ON "article_comments"("article_id", "hidden", "id");

-- CreateIndex
CREATE UNIQUE INDEX "shop_items_slug_key" ON "shop_items"("slug");

-- CreateIndex
CREATE INDEX "shop_items_active_sort_idx" ON "shop_items"("active", "sort");

-- CreateIndex
CREATE UNIQUE INDEX "shop_orders_order_no_key" ON "shop_orders"("order_no");

-- CreateIndex
CREATE INDEX "shop_orders_user_id_id_idx" ON "shop_orders"("user_id", "id");

-- CreateIndex
CREATE INDEX "grants_user_id_kind_idx" ON "grants"("user_id", "kind");

-- CreateIndex
CREATE INDEX "users_points_idx" ON "users"("points");

-- AddForeignKey
ALTER TABLE "moments" ADD CONSTRAINT "moments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moment_likes" ADD CONSTRAINT "moment_likes_moment_id_fkey" FOREIGN KEY ("moment_id") REFERENCES "moments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moment_likes" ADD CONSTRAINT "moment_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moment_comments" ADD CONSTRAINT "moment_comments_moment_id_fkey" FOREIGN KEY ("moment_id") REFERENCES "moments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moment_comments" ADD CONSTRAINT "moment_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discussions" ADD CONSTRAINT "discussions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discussion_replies" ADD CONSTRAINT "discussion_replies_discussion_id_fkey" FOREIGN KEY ("discussion_id") REFERENCES "discussions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discussion_replies" ADD CONSTRAINT "discussion_replies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_comments" ADD CONSTRAINT "article_comments_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_comments" ADD CONSTRAINT "article_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_orders" ADD CONSTRAINT "shop_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_orders" ADD CONSTRAINT "shop_orders_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "shop_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grants" ADD CONSTRAINT "grants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

