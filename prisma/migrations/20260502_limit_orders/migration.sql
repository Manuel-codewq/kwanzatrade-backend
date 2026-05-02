-- Add PENDING status for limit orders
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'PENDING';

-- Add limitPrice column to Order
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "limitPrice" DOUBLE PRECISION;
