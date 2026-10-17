-- Convite escolar: o banco guarda so o resumo SHA-256 do token, como no
-- acesso inicial (revisao de 16/10). O link continua levando o token.
-- Convite que ja existe tem o resumo calculado aqui, e continua valendo.

-- DropIndex
DROP INDEX "convite_escolar_token_key";

-- AlterTable
ALTER TABLE "convite_escolar" ADD COLUMN "tokenResumo" TEXT;
UPDATE "convite_escolar" SET "tokenResumo" = encode(sha256(convert_to("token", 'UTF8')), 'hex');
ALTER TABLE "convite_escolar" ALTER COLUMN "tokenResumo" SET NOT NULL;
ALTER TABLE "convite_escolar" DROP COLUMN "token";

-- CreateIndex
CREATE UNIQUE INDEX "convite_escolar_tokenResumo_key" ON "convite_escolar"("tokenResumo");

ALTER TABLE "convite_escolar" ADD CONSTRAINT "convite_escolar_token_resumo_sha256"
  CHECK ("tokenResumo" ~ '^[0-9a-f]{64}$');
