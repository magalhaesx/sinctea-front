-- Chaves compostas sem cascata na atualizacao. Com ON UPDATE CASCADE, trocar
-- consentimento.pacienteId levaria junto, em silencio, o vinculo escolar e as
-- ocorrencias para outro paciente: a regra 2 escapando pela atualizacao.
-- Agora a troca e recusada enquanto houver linha apontando para o alvo.

-- DropForeignKey
ALTER TABLE "ocorrencia_comportamental" DROP CONSTRAINT "ocorrencia_comportamental_ocorrenciaEscolarId_pacienteId_fkey";

-- DropForeignKey
ALTER TABLE "ocorrencia_comportamental" DROP CONSTRAINT "ocorrencia_comportamental_sessaoId_pacienteId_fkey";

-- DropForeignKey
ALTER TABLE "ocorrencia_escolar" DROP CONSTRAINT "ocorrencia_escolar_vinculoId_pacienteId_professorId_fkey";

-- DropForeignKey
ALTER TABLE "vinculo_escolar" DROP CONSTRAINT "vinculo_escolar_consentimentoId_pacienteId_fkey";

-- DropForeignKey
ALTER TABLE "vinculo_escolar" DROP CONSTRAINT "vinculo_escolar_conviteId_consentimentoId_fkey";

-- AddForeignKey
ALTER TABLE "ocorrencia_comportamental" ADD CONSTRAINT "ocorrencia_comportamental_sessaoId_pacienteId_fkey" FOREIGN KEY ("sessaoId", "pacienteId") REFERENCES "sessao"("id", "pacienteId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ocorrencia_comportamental" ADD CONSTRAINT "ocorrencia_comportamental_ocorrenciaEscolarId_pacienteId_fkey" FOREIGN KEY ("ocorrenciaEscolarId", "pacienteId") REFERENCES "ocorrencia_escolar"("id", "pacienteId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "vinculo_escolar" ADD CONSTRAINT "vinculo_escolar_consentimentoId_pacienteId_fkey" FOREIGN KEY ("consentimentoId", "pacienteId") REFERENCES "consentimento"("id", "pacienteId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "vinculo_escolar" ADD CONSTRAINT "vinculo_escolar_conviteId_consentimentoId_fkey" FOREIGN KEY ("conviteId", "consentimentoId") REFERENCES "convite_escolar"("id", "consentimentoId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ocorrencia_escolar" ADD CONSTRAINT "ocorrencia_escolar_vinculoId_pacienteId_professorId_fkey" FOREIGN KEY ("vinculoId", "pacienteId", "professorId") REFERENCES "vinculo_escolar"("id", "pacienteId", "professorId") ON DELETE RESTRICT ON UPDATE RESTRICT;

