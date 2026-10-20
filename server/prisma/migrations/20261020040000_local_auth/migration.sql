-- Preserve existing profiles while detaching identity from Supabase Auth.
ALTER TABLE "public"."profiles" DROP CONSTRAINT IF EXISTS "profiles_auth_user_fkey";
CREATE TABLE "public"."accounts" (
 "id" UUID NOT NULL, "email" VARCHAR(254) NOT NULL, "password_hash" TEXT NOT NULL,
 CONSTRAINT "accounts_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "accounts_id_fkey" FOREIGN KEY ("id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "accounts_email_key" ON "public"."accounts"("email");
CREATE TABLE "public"."auth_sessions" (
 "id" UUID NOT NULL, "account_id" UUID NOT NULL, "access_hash" TEXT NOT NULL, "refresh_hash" TEXT NOT NULL,
 "access_expires_at" TIMESTAMPTZ(3) NOT NULL, "refresh_expires_at" TIMESTAMPTZ(3) NOT NULL,
 CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "auth_sessions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "auth_sessions_access_hash_key" ON "public"."auth_sessions"("access_hash");
CREATE UNIQUE INDEX "auth_sessions_refresh_hash_key" ON "public"."auth_sessions"("refresh_hash");
CREATE INDEX "auth_sessions_account_id_idx" ON "public"."auth_sessions"("account_id");
ALTER TABLE "public"."accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."auth_sessions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."accounts", "public"."auth_sessions" FROM anon, authenticated;
