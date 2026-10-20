CREATE SCHEMA IF NOT EXISTS "public";
CREATE TYPE "Role" AS ENUM ('SME', 'OPERATOR', 'RIDER');

CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "full_name" VARCHAR(120),
    "phone" VARCHAR(32),
    "role" "Role" NOT NULL DEFAULT 'SME',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "profiles_auth_user_fkey" FOREIGN KEY ("id")
      REFERENCES "auth"."users"("id") ON DELETE CASCADE
);

-- Backend-only access. Prisma does not inherit a request's Supabase JWT.
ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."profiles" FROM anon, authenticated;
