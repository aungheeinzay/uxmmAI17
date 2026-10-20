-- Existing accounts remain unverified until mailbox ownership is proven.
-- Preserve accounts, profiles and sessions. Application guards block unverified access.
ALTER TABLE "public"."accounts" ADD COLUMN "email_verified_at" TIMESTAMPTZ(3);

CREATE TABLE "public"."email_verification_tokens" (
  "id" UUID NOT NULL,
  "account_id" UUID NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "email_verification_tokens_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "email_verification_tokens_account_id_key" ON "public"."email_verification_tokens"("account_id");
CREATE UNIQUE INDEX "email_verification_tokens_token_hash_key" ON "public"."email_verification_tokens"("token_hash");
CREATE INDEX "email_verification_tokens_expires_at_idx" ON "public"."email_verification_tokens"("expires_at");

CREATE TABLE "public"."password_reset_tokens" (
  "id" UUID NOT NULL,
  "account_id" UUID NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "password_reset_tokens_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "password_reset_tokens_account_id_key" ON "public"."password_reset_tokens"("account_id");
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "public"."password_reset_tokens"("token_hash");
CREATE INDEX "password_reset_tokens_expires_at_idx" ON "public"."password_reset_tokens"("expires_at");

ALTER TABLE "public"."email_verification_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."password_reset_tokens" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."email_verification_tokens", "public"."password_reset_tokens" FROM anon, authenticated;
