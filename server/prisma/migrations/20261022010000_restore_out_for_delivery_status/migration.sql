-- Repair observed development schema drift: migration history included this
-- approved value, but the actual public.OrderStatus enum did not contain it.
-- Idempotent and additive; existing enum values and parcel records are preserved.
ALTER TYPE "public"."OrderStatus"
  ADD VALUE IF NOT EXISTS 'OUT_FOR_DELIVERY' AFTER 'IN_TRANSIT';
