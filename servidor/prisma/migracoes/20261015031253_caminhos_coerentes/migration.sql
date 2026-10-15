-- DropForeignKey
ALTER TABLE "objetivo" DROP CONSTRAINT "objetivo_planoId_fkey";

-- DropForeignKey
ALTER TABLE "ocorrencia_comportamental" DROP CONSTRAINT "ocorrencia_comportamental_ocorrenciaEscolarId_fkey";

-- DropForeignKey
ALTER TABLE "ocorrencia_comportamental" DROP CONSTRAINT "ocorrencia_comportamental_sessaoId_fkey";

-- DropForeignKey
ALTER TABLE "ocorrencia_escolar" DROP CONSTRAINT "ocorrencia_escolar_vinculoId_fkey";

-- DropForeignKey
ALTER TABLE "registro_atividade" DROP CONSTRAINT "registro_atividade_sessaoId_fkey";

-- DropForeignKey
ALTER TABLE "vinculo_escolar" DROP CONSTRAINT "vinculo_escolar_consentimentoId_fkey";

-- DropForeignKey
ALTER TABLE "vinculo_escolar" DROP CONSTRAINT "vinculo_escolar_conviteId_fkey";

-- CreateIndex
CREATE INDEX "atividade_casa_pacienteId_idx" ON "atividade_casa"("pacienteId");

-- CreateIndex
CREATE INDEX "cartao_estrategia_objetivoId_idx" ON "cartao_estrategia"("objetivoId");

-- CreateIndex
CREATE INDEX "consentimento_pacienteId_idx" ON "consentimento"("pacienteId");

-- CreateIndex
CREATE UNIQUE INDEX "consentimento_id_pacienteId_key" ON "consentimento"("id", "pacienteId");

-- CreateIndex
CREATE INDEX "convite_escolar_consentimentoId_idx" ON "convite_escolar"("consentimentoId");

-- CreateIndex
CREATE UNIQUE INDEX "convite_escolar_id_consentimentoId_key" ON "convite_escolar"("id", "consentimentoId");

-- CreateIndex
CREATE INDEX "execucao_atividade_casa_atividadeId_idx" ON "execucao_atividade_casa"("atividadeId");

-- CreateIndex
CREATE INDEX "objetivo_planoId_idx" ON "objetivo"("planoId");

-- CreateIndex
CREATE INDEX "ocorrencia_comportamental_pacienteId_ocorridaEm_idx" ON "ocorrencia_comportamental"("pacienteId", "ocorridaEm");

-- CreateIndex
CREATE UNIQUE INDEX "ocorrencia_comportamental_ocorrenciaEscolarId_pacienteId_key" ON "ocorrencia_comportamental"("ocorrenciaEscolarId", "pacienteId");

-- CreateIndex
CREATE UNIQUE INDEX "ocorrencia_escolar_id_pacienteId_key" ON "ocorrencia_escolar"("id", "pacienteId");

-- CreateIndex
CREATE INDEX "paciente_equipe_profissionalId_idx" ON "paciente_equipe"("profissionalId");

-- CreateIndex
CREATE INDEX "plano_terapeutico_pacienteId_idx" ON "plano_terapeutico"("pacienteId");

-- CreateIndex
CREATE INDEX "registro_atividade_sessaoId_idx" ON "registro_atividade"("sessaoId");

-- CreateIndex
CREATE INDEX "registro_atividade_objetivoId_idx" ON "registro_atividade"("objetivoId");

-- CreateIndex
CREATE INDEX "registro_auditoria_pacienteId_ocorridoEm_idx" ON "registro_auditoria"("pacienteId", "ocorridoEm");

-- CreateIndex
CREATE INDEX "registro_auditoria_usuarioId_idx" ON "registro_auditoria"("usuarioId");

-- CreateIndex
CREATE INDEX "relatorio_evolucao_pacienteId_emitidoEm_idx" ON "relatorio_evolucao"("pacienteId", "emitidoEm");

-- CreateIndex
CREATE INDEX "sessao_pacienteId_idx" ON "sessao"("pacienteId");

-- CreateIndex
CREATE INDEX "sessao_profissionalId_inicioPrevistoEm_idx" ON "sessao"("profissionalId", "inicioPrevistoEm");

-- CreateIndex
CREATE UNIQUE INDEX "sessao_id_pacienteId_key" ON "sessao"("id", "pacienteId");

-- CreateIndex
CREATE INDEX "vinculo_escolar_professorId_pacienteId_idx" ON "vinculo_escolar"("professorId", "pacienteId");

-- CreateIndex
CREATE UNIQUE INDEX "vinculo_escolar_id_pacienteId_professorId_key" ON "vinculo_escolar"("id", "pacienteId", "professorId");

-- CreateIndex
CREATE UNIQUE INDEX "vinculo_escolar_conviteId_consentimentoId_key" ON "vinculo_escolar"("conviteId", "consentimentoId");

-- CreateIndex
CREATE INDEX "vinculo_familiar_responsavelId_idx" ON "vinculo_familiar"("responsavelId");

-- CreateIndex
CREATE INDEX "vinculo_familiar_pacienteId_idx" ON "vinculo_familiar"("pacienteId");

-- AddForeignKey
ALTER TABLE "registro_atividade" ADD CONSTRAINT "registro_atividade_sessaoId_fkey" FOREIGN KEY ("sessaoId") REFERENCES "sessao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objetivo" ADD CONSTRAINT "objetivo_planoId_fkey" FOREIGN KEY ("planoId") REFERENCES "plano_terapeutico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocorrencia_comportamental" ADD CONSTRAINT "ocorrencia_comportamental_sessaoId_pacienteId_fkey" FOREIGN KEY ("sessaoId", "pacienteId") REFERENCES "sessao"("id", "pacienteId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocorrencia_comportamental" ADD CONSTRAINT "ocorrencia_comportamental_ocorrenciaEscolarId_pacienteId_fkey" FOREIGN KEY ("ocorrenciaEscolarId", "pacienteId") REFERENCES "ocorrencia_escolar"("id", "pacienteId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vinculo_escolar" ADD CONSTRAINT "vinculo_escolar_consentimentoId_pacienteId_fkey" FOREIGN KEY ("consentimentoId", "pacienteId") REFERENCES "consentimento"("id", "pacienteId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vinculo_escolar" ADD CONSTRAINT "vinculo_escolar_conviteId_consentimentoId_fkey" FOREIGN KEY ("conviteId", "consentimentoId") REFERENCES "convite_escolar"("id", "consentimentoId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocorrencia_escolar" ADD CONSTRAINT "ocorrencia_escolar_vinculoId_pacienteId_professorId_fkey" FOREIGN KEY ("vinculoId", "pacienteId", "professorId") REFERENCES "vinculo_escolar"("id", "pacienteId", "professorId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- Acrescentado a mao: caminhos de mais de um passo e a coluna que define o
-- dono, que nenhuma chave estrangeira expressa. O Prisma nao acompanha trigger.
-- ============================================================================

-- O objetivo de uma atividade de casa, ou de um registro de sessao, tem de ser
-- do plano do mesmo paciente.
CREATE FUNCTION exigir_objetivo_do_paciente() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE dono uuid; esperado uuid;
BEGIN
  SELECT p."pacienteId" INTO dono
    FROM objetivo o JOIN plano_terapeutico p ON p.id = o."planoId"
   WHERE o.id = NEW."objetivoId";
  IF TG_TABLE_NAME = 'registro_atividade' THEN
    SELECT s."pacienteId" INTO esperado FROM sessao s WHERE s.id = NEW."sessaoId";
  ELSE
    esperado := NEW."pacienteId";
  END IF;
  IF dono IS DISTINCT FROM esperado THEN
    RAISE EXCEPTION 'SINCTEA: % recusado em %: o objetivo % e de outro paciente',
      TG_OP, TG_TABLE_NAME, NEW."objetivoId" USING ERRCODE = 'P0002';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER atividade_casa_mesmo_paciente BEFORE INSERT OR UPDATE OF "pacienteId", "objetivoId"
  ON atividade_casa FOR EACH ROW EXECUTE FUNCTION exigir_objetivo_do_paciente();
CREATE TRIGGER registro_atividade_mesmo_paciente BEFORE INSERT OR UPDATE OF "sessaoId", "objetivoId"
  ON registro_atividade FOR EACH ROW EXECUTE FUNCTION exigir_objetivo_do_paciente();

-- Os objetivos que o relatorio abrange existem e sao do paciente do relatorio.
-- objetivoIds e fotografia, sem chave estrangeira: a conferencia e na emissao.
CREATE FUNCTION exigir_objetivos_do_relatorio() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM unnest(NEW."objetivoIds") AS x(id)
      LEFT JOIN objetivo o ON o.id = x.id
      LEFT JOIN plano_terapeutico p ON p.id = o."planoId"
     WHERE p."pacienteId" IS DISTINCT FROM NEW."pacienteId") THEN
    RAISE EXCEPTION 'SINCTEA: relatorio cobre objetivo inexistente ou de outro paciente'
      USING ERRCODE = 'P0002';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER relatorio_evolucao_mesmo_paciente BEFORE INSERT ON relatorio_evolucao
  FOR EACH ROW EXECUTE FUNCTION exigir_objetivos_do_relatorio();

-- A coluna que define o dono nao muda depois de criada: mudar o paciente de um
-- plano, o plano de um objetivo ou o paciente de uma sessao levaria junto,
-- calado, tudo o que pende dela.
CREATE FUNCTION recusar_troca_de_dono() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'SINCTEA: % de % nao muda depois de criado', TG_ARGV[0], TG_TABLE_NAME
    USING ERRCODE = 'P0002';
END $$;
CREATE TRIGGER plano_dono_fixo BEFORE UPDATE OF "pacienteId" ON plano_terapeutico
  FOR EACH ROW WHEN (OLD."pacienteId" IS DISTINCT FROM NEW."pacienteId")
  EXECUTE FUNCTION recusar_troca_de_dono('pacienteId');
CREATE TRIGGER objetivo_dono_fixo BEFORE UPDATE OF "planoId" ON objetivo
  FOR EACH ROW WHEN (OLD."planoId" IS DISTINCT FROM NEW."planoId")
  EXECUTE FUNCTION recusar_troca_de_dono('planoId');
CREATE TRIGGER sessao_dono_fixo BEFORE UPDATE OF "pacienteId" ON sessao
  FOR EACH ROW WHEN (OLD."pacienteId" IS DISTINCT FROM NEW."pacienteId")
  EXECUTE FUNCTION recusar_troca_de_dono('pacienteId');
