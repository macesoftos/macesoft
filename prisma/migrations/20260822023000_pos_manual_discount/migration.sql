-- Preserve cashier-entered discounts while an open POS cart is saved.
ALTER TABLE "PosCart"
  ADD COLUMN "manualDiscountType" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "manualDiscountValue" DOUBLE PRECISION NOT NULL DEFAULT 0;
