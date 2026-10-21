-- Additive migration: existing accounts, profiles and sessions are unchanged.
CREATE TABLE "public"."rider_invitations" (
  "id" UUID NOT NULL,
  "email" VARCHAR(254) NOT NULL,
  "full_name" VARCHAR(120),
  "token_hash" TEXT NOT NULL,
  "invited_by_id" UUID NOT NULL,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "accepted_at" TIMESTAMPTZ(3),
  "revoked_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "rider_invitations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "rider_invitations_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "public"."accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "rider_invitations_email_key" ON "public"."rider_invitations"("email");
CREATE UNIQUE INDEX "rider_invitations_token_hash_key" ON "public"."rider_invitations"("token_hash");
CREATE INDEX "rider_invitations_invited_by_id_idx" ON "public"."rider_invitations"("invited_by_id");
CREATE INDEX "rider_invitations_expires_at_idx" ON "public"."rider_invitations"("expires_at");
ALTER TABLE "public"."rider_invitations" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."rider_invitations" FROM anon, authenticated;
