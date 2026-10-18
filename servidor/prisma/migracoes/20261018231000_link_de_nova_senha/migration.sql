-- Item 8: o link de definir senha serve tambem a nova senha do responsavel,
-- que so a coordenacao gera, com motivo. O motivo vai para a trilha, imutavel;
-- aqui fica quem gerou, para o aviso do proximo acesso dizer o nome, e quando
-- a pessoa deu ciencia dele. Os links que ja existem sao de primeiro acesso.

-- CreateEnum
CREATE TYPE "finalidade_acesso" AS ENUM ('PRIMEIRO_ACESSO', 'NOVA_SENHA');

-- AlterTable
ALTER TABLE "acesso_inicial" ADD COLUMN     "avisadoEm" TIMESTAMPTZ(3),
ADD COLUMN     "finalidade" "finalidade_acesso" NOT NULL DEFAULT 'PRIMEIRO_ACESSO',
ADD COLUMN     "geradoPorId" UUID;

-- CreateIndex
CREATE INDEX "acesso_inicial_geradoPorId_idx" ON "acesso_inicial"("geradoPorId");

-- AddForeignKey
ALTER TABLE "acesso_inicial" ADD CONSTRAINT "acesso_inicial_geradoPorId_fkey" FOREIGN KEY ("geradoPorId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- O link de nova senha sempre diz quem o gerou; o de primeiro acesso, nunca.
ALTER TABLE "acesso_inicial" ADD CONSTRAINT "acesso_inicial_nova_senha_com_autor"
  CHECK (("finalidade" = 'NOVA_SENHA') = ("geradoPorId" IS NOT NULL));

-- Ciencia so do aviso de nova senha, e so depois de o link ser usado.
ALTER TABLE "acesso_inicial" ADD CONSTRAINT "acesso_inicial_ciencia_depois_do_uso"
  CHECK ("avisadoEm" IS NULL OR ("finalidade" = 'NOVA_SENHA' AND "usadoEm" IS NOT NULL AND "avisadoEm" >= "usadoEm"));
