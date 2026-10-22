-- Additive Rider onboarding data. Existing profiles, orders and assignments are untouched.
CREATE TYPE "VehicleType" AS ENUM ('MOTORCYCLE', 'BICYCLE', 'CAR', 'VAN', 'ON_FOOT');

CREATE TABLE "public"."rider_profiles" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "vehicle_type" "VehicleType",
    "vehicle_plate_number" VARCHAR(32),
    "vehicle_model" VARCHAR(120),
    "vehicle_color" VARCHAR(64),
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "rider_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rider_profiles_profile_id_key" ON "public"."rider_profiles"("profile_id");

ALTER TABLE "public"."rider_profiles" ADD CONSTRAINT "rider_profiles_profile_id_fkey"
    FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Match the repository convention for new tables: no direct PostgREST access.
ALTER TABLE "public"."rider_profiles" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."rider_profiles" FROM anon, authenticated;
