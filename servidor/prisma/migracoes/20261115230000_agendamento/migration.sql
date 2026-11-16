-- Item 19b: o agendamento de sessao. A sessao AGENDADA existe antes de
-- comecar; a CANCELADA, nunca comecou. As duas nao tem numero: ele nasce no
-- inicio, e segue a ordem em que as sessoes do paciente comecaram, porque
-- evolucao, indicadores e relatorio ordenam por ele. Agendamento cancelado
-- nao gasta numero.
--
-- O Prisma nao acompanha CHECK nem indice parcial ou de expressao: nada disto
-- vira divergencia no schema.prisma, e quem gerar a proxima migracao confere
-- que ela nao os apaga.

-- AlterTable
ALTER TABLE "sessao" ALTER COLUMN "numero" DROP NOT NULL;

-- Ate aqui so a sessao iniciada existia no servidor; a semente de teste
-- numerava tambem a agendada. Nenhuma sessao comecada perde o numero.
UPDATE "sessao" SET "numero" = NULL WHERE "situacao" IN ('AGENDADA', 'CANCELADA') AND "inicio" IS NULL;

-- Numero e inicio andam juntos: a agendada e a cancelada nao tem nenhum dos
-- dois; a que comecou (em andamento, pausada, encerrada) tem os dois, e o
-- numero a partir de 1.
ALTER TABLE "sessao" ADD CONSTRAINT "sessao_numero_so_iniciada" CHECK (
  ("situacao" IN ('AGENDADA', 'CANCELADA') AND "numero" IS NULL AND "inicio" IS NULL)
  OR ("situacao" NOT IN ('AGENDADA', 'CANCELADA') AND "numero" IS NOT NULL AND "numero" >= 1 AND "inicio" IS NOT NULL)
);

-- O local, como no dominio (validarAgendamento): obrigatorio, ate 100 caracteres.
ALTER TABLE "sessao" ADD CONSTRAINT "sessao_local_limite" CHECK (
  btrim("local") <> '' AND char_length("local") <= 100
);

-- Dois inicios ao mesmo tempo nao repetem numero: o servidor trava o paciente
-- para numerar, e este indice e a garantia.
CREATE UNIQUE INDEX "sessao_pacienteId_numero_key" ON "sessao"("pacienteId", "numero") WHERE "numero" IS NOT NULL;

-- O mesmo profissional nao fica com dois agendamentos no mesmo horario.
CREATE UNIQUE INDEX "sessao_agendada_profissional_horario_key" ON "sessao"("profissionalId", "inicioPrevistoEm")
  WHERE "situacao" = 'AGENDADA';

-- Nem com dois agendamentos do mesmo paciente no mesmo dia de Manaus. O dia e
-- o de Manaus, e nao o de UTC: a sessao das 23h30 e daquele dia, embora em UTC
-- ja seja o seguinte (compartilhado/src/dominio/agenda.ts).
CREATE UNIQUE INDEX "sessao_agendada_paciente_profissional_dia_key" ON "sessao"(
  "pacienteId", "profissionalId", (("inicioPrevistoEm" AT TIME ZONE 'America/Manaus')::date)
) WHERE "situacao" = 'AGENDADA';
