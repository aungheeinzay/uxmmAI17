-- Associate new orders with an Operator profile while retaining legacy delivery services.

ALTER TABLE "orders" ADD COLUMN "operator_id" UUID;
ALTER TABLE "orders" ALTER COLUMN "delivery_service_id" DROP NOT NULL;

ALTER TABLE "orders" ADD CONSTRAINT "orders_operator_id_fkey"
    FOREIGN KEY ("operator_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "orders_operator_id_idx" ON "orders"("operator_id");
ALTER TABLE "orders" ADD CONSTRAINT "orders_assignment_required"
    CHECK ("operator_id" IS NOT NULL OR "delivery_service_id" IS NOT NULL);