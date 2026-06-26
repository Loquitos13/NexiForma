-- Remover estado PENDENTE das presenças (assiduidade só: presente / falta justificada / injustificada)

ALTER TABLE "presencas" ALTER COLUMN "estado" DROP NOT NULL;
ALTER TABLE "presencas" ALTER COLUMN "estado" DROP DEFAULT;

UPDATE "presencas" SET "estado" = NULL WHERE "estado" = 'PENDENTE';
