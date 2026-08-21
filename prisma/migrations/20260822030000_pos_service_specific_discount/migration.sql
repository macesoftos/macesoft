-- Allow a cashier-entered discount to target one exact service line.
ALTER TABLE "PosCart"
  ADD COLUMN "manualDiscountScope" TEXT NOT NULL DEFAULT 'Transaction',
  ADD COLUMN "manualDiscountTargetKey" TEXT NOT NULL DEFAULT '';
