-- Additive only. Prepared offline; apply only after verifying a dedicated development target.
CREATE TABLE "public"."rider_assignments" (
  "id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "rider_id" UUID NOT NULL,
  "assigned_by_id" UUID NOT NULL,
  "assigned_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "rider_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "rider_assignments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "rider_assignments_rider_id_fkey" FOREIGN KEY ("rider_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "rider_assignments_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "rider_assignments_order_id_key" ON "public"."rider_assignments"("order_id");
CREATE INDEX "rider_assignments_rider_id_assigned_at_idx" ON "public"."rider_assignments"("rider_id", "assigned_at");
ALTER TABLE "public"."rider_assignments" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."rider_assignments" FROM anon, authenticated;
