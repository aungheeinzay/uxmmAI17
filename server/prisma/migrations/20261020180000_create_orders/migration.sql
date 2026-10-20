-- Feature 1: delivery-service catalog and SME-owned orders.
-- Application access is through Express/Prisma. RLS stays enabled; direct
-- anon/authenticated Supabase access is revoked.

CREATE TYPE "OrderStatus" AS ENUM ('CREATED');

CREATE TABLE "delivery_services" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "delivery_services_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "delivery_services_is_active_idx" ON "delivery_services"("is_active");

CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "order_code" VARCHAR(32) NOT NULL,
    "owner_id" UUID NOT NULL,
    "delivery_service_id" UUID NOT NULL,
    "recipient_name" VARCHAR(120) NOT NULL,
    "phone_number" VARCHAR(32) NOT NULL,
    "township" VARCHAR(120) NOT NULL,
    "delivery_address" VARCHAR(500) NOT NULL,
    "parcel_weight_kg" DECIMAL(8,3) NOT NULL,
    "cod_amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'MMK',
    "sender_name" VARCHAR(120) NOT NULL,
    "delivery_instructions" VARCHAR(1000),
    "status" "OrderStatus" NOT NULL DEFAULT 'CREATED',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "orders_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "orders_parcel_weight_kg_positive" CHECK ("parcel_weight_kg" > 0),
    CONSTRAINT "orders_cod_amount_nonnegative" CHECK ("cod_amount" >= 0),
    CONSTRAINT "orders_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "orders_delivery_service_id_fkey" FOREIGN KEY ("delivery_service_id") REFERENCES "delivery_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "orders_order_code_key" ON "orders"("order_code");
CREATE INDEX "orders_owner_id_idx" ON "orders"("owner_id");
CREATE INDEX "orders_delivery_service_id_idx" ON "orders"("delivery_service_id");

ALTER TABLE "public"."delivery_services" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."delivery_services", "public"."orders" FROM anon, authenticated;
