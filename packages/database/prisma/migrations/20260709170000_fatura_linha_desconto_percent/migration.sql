-- Desconto comercial por linha de fatura (%)
ALTER TABLE "public"."faturas_linhas"
ADD COLUMN "desconto_percent" DECIMAL(5, 2) NOT NULL DEFAULT 0;
