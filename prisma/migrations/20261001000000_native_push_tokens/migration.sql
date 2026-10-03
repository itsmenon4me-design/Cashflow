CREATE TABLE "native_push_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "native_push_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "native_push_tokens_token_key"
ON "native_push_tokens"("token");

CREATE INDEX "native_push_tokens_user_id_idx"
ON "native_push_tokens"("user_id");

ALTER TABLE "native_push_tokens"
ADD CONSTRAINT "native_push_tokens_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
