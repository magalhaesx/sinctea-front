-- Evolucao da sessao (Resolucao CFP 001/2009, registro documental): o texto
-- que o profissional escreve ao encerrar. Item 7 do caminho principal.
ALTER TABLE "sessao" ADD COLUMN     "evolucao" TEXT;

-- Preenchida se, e somente se, a sessao esta encerrada, e nunca em branco.
-- NOT VALID: vale para toda linha nova ou alterada, mas nao confere as que ja
-- existem. As sessoes que o primeiro ensaio encerrou no Neon, antes desta
-- migracao, nao tem evolucao, e inventar uma no lugar do profissional e o que
-- a regra proibe. Elas saem quando o banco for zerado.
ALTER TABLE "sessao" ADD CONSTRAINT "sessao_evolucao_so_encerrada" CHECK (
  (situacao = 'ENCERRADA' AND evolucao IS NOT NULL AND btrim(evolucao) <> '')
  OR (situacao <> 'ENCERRADA' AND evolucao IS NULL)
) NOT VALID;
