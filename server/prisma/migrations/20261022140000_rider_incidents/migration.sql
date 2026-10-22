-- Additive Rider incident reporting. Existing orders, assignments and profiles are untouched.
-- hasIncident is always derived from these records; reporting never changes the order status.
CREATE TYPE "IncidentType" AS ENUM ('DAMAGED', 'BROKEN', 'LOST');
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'REVIEWED');

CREATE TABLE "public"."rider_incidents" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "rider_id" UUID NOT NULL,
    "assignment_id" UUID,
    "provider_id" UUID NOT NULL,
    "type" "IncidentType" NOT NULL,
    "reason" VARCHAR(200) NOT NULL,
    "description" VARCHAR(1000) NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "reviewed_at" TIMESTAMPTZ(3),
    "reviewed_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "rider_incidents_pkey" PRIMARY KEY ("id")
);

-- One report of a given type per parcel prevents accidental duplicate submissions.
CREATE UNIQUE INDEX "rider_incidents_order_id_type_key" ON "public"."rider_incidents"("order_id", "type");
CREATE INDEX "rider_incidents_rider_id_created_at_idx" ON "public"."rider_incidents"("rider_id", "created_at");
CREATE INDEX "rider_incidents_provider_id_status_created_at_idx" ON "public"."rider_incidents"("provider_id", "status", "created_at");

ALTER TABLE "public"."rider_incidents" ADD CONSTRAINT "rider_incidents_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."rider_incidents" ADD CONSTRAINT "rider_incidents_rider_id_fkey"
    FOREIGN KEY ("rider_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."rider_incidents" ADD CONSTRAINT "rider_incidents_assignment_id_fkey"
    FOREIGN KEY ("assignment_id") REFERENCES "public"."rider_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."rider_incidents" ADD CONSTRAINT "rider_incidents_provider_id_fkey"
    FOREIGN KEY ("provider_id") REFERENCES "public"."legacy_delivery_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."rider_incidents" ADD CONSTRAINT "rider_incidents_reviewed_by_id_fkey"
    FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Match the repository convention for new tables: no direct PostgREST access.
ALTER TABLE "public"."rider_incidents" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."rider_incidents" FROM anon, authenticated;
