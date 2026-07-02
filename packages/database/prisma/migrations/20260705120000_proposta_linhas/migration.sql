-- Linhas de proposta comercial (itens tipo fatura)
CREATE TABLE "public"."propostas_linhas" (
    "id" UUID NOT NULL,
    "proposta_id" UUID NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 1,
    "descricao" TEXT NOT NULL,
    "quantidade" DECIMAL(12,4) NOT NULL DEFAULT 1,
    "preco_unit_centavos" INTEGER NOT NULL,
    "taxa_iva" DECIMAL(5,2) NOT NULL,
    "valor_iva_centavos" INTEGER NOT NULL,

    CONSTRAINT "propostas_linhas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "propostas_linhas_proposta_id_idx" ON "public"."propostas_linhas"("proposta_id");

ALTER TABLE "public"."propostas_linhas" ADD CONSTRAINT "propostas_linhas_proposta_id_fkey" FOREIGN KEY ("proposta_id") REFERENCES "public"."propostas_comerciais"("id") ON DELETE CASCADE ON UPDATE CASCADE;
