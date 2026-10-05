-- CreateTable
CREATE TABLE "direct_messages" (
    "id" BIGSERIAL NOT NULL,
    "conversation_key" VARCHAR(40) NOT NULL,
    "sender_id" BIGINT NOT NULL,
    "receiver_id" BIGINT NOT NULL,
    "content" VARCHAR(2000) NOT NULL,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "direct_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "direct_messages_conversation_key_id_idx" ON "direct_messages"("conversation_key", "id");

-- CreateIndex
CREATE INDEX "direct_messages_receiver_id_read_at_idx" ON "direct_messages"("receiver_id", "read_at");

-- AddForeignKey
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

