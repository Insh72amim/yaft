ALTER TABLE "Asset"
ADD COLUMN "isin" TEXT,
ADD COLUMN "sector" TEXT;

CREATE UNIQUE INDEX "Asset_isin_key" ON "Asset"("isin");

ALTER TABLE "PortfolioHolding"
ADD COLUMN "availableQuantity" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN "discrepantQuantity" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN "longTermQuantity" DECIMAL(65,30),
ADD COLUMN "pledgedQuantity" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN "previousClosingPrice" BIGINT,
ADD COLUMN "unrealizedPnl" BIGINT;

UPDATE "PortfolioHolding" SET "availableQuantity" = "quantity";
