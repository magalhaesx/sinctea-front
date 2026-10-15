-- CreateEnum
CREATE TYPE "perfil" AS ENUM ('TERAPEUTA', 'COORDENADOR', 'ADMINISTRADOR', 'RESPONSAVEL', 'PROFESSOR');

-- CreateEnum
CREATE TYPE "situacao_plano" AS ENUM ('RASCUNHO', 'AGUARDANDO_VALIDACAO', 'DEVOLVIDO', 'VIGENTE');

-- CreateEnum
CREATE TYPE "status_objetivo" AS ENUM ('NAO_INICIADO', 'EM_AQUISICAO', 'DOMINADO');

-- CreateEnum
CREATE TYPE "resultado" AS ENUM ('INDEPENDENTE', 'AJUDA_GESTUAL', 'AJUDA_FISICA', 'SEM_RESPOSTA');

-- CreateEnum
CREATE TYPE "situacao_sessao" AS ENUM ('AGENDADA', 'EM_ANDAMENTO', 'PAUSADA', 'ENCERRADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "status_sync" AS ENUM ('PENDENTE', 'SINCRONIZADO');

-- CreateEnum
CREATE TYPE "origem" AS ENUM ('CLINICA', 'CASA', 'ESCOLA');

-- CreateEnum
CREATE TYPE "destinatario" AS ENUM ('PROFISSIONAIS', 'FAMILIA');

-- CreateEnum
CREATE TYPE "desempenho" AS ENUM ('SOZINHO', 'COM_AJUDA', 'NAO_QUIS');

-- CreateEnum
CREATE TYPE "escopo_acesso" AS ENUM ('CARTAO_ESTRATEGIA', 'REGISTRO_OCORRENCIA');

-- CreateEnum
CREATE TYPE "status_vinculo" AS ENUM ('ATIVO', 'ENCERRADO');

-- CreateEnum
CREATE TYPE "acao_auditoria" AS ENUM ('CONCESSAO_ACESSO', 'REVOGACAO_ACESSO', 'LEITURA_AUTORIZADA', 'ACESSO_NEGADO', 'CRIACAO', 'ALTERACAO');

-- CreateEnum
CREATE TYPE "origem_auditoria" AS ENUM ('CLINICA', 'FAMILIA', 'ESCOLA', 'SISTEMA');

-- CreateTable
CREATE TABLE "usuario" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "perfis" "perfil"[],
    "ativo" BOOLEAN NOT NULL,
    "ultimoAcessoEm" TIMESTAMPTZ(3),

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profissional" (
    "usuarioId" UUID NOT NULL,
    "especialidade" TEXT NOT NULL,
    "registroConselho" TEXT NOT NULL,

    CONSTRAINT "profissional_pkey" PRIMARY KEY ("usuarioId")
);

-- CreateTable
CREATE TABLE "responsavel" (
    "usuarioId" UUID NOT NULL,
    "telefone" TEXT NOT NULL,

    CONSTRAINT "responsavel_pkey" PRIMARY KEY ("usuarioId")
);

-- CreateTable
CREATE TABLE "professor_aee" (
    "usuarioId" UUID NOT NULL,

    CONSTRAINT "professor_aee_pkey" PRIMARY KEY ("usuarioId")
);

-- CreateTable
CREATE TABLE "paciente" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "dataNascimento" DATE NOT NULL,
    "nivelSuporte" INTEGER NOT NULL,
    "profissionalResponsavelId" UUID NOT NULL,
    "ativo" BOOLEAN NOT NULL,

    CONSTRAINT "paciente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paciente_equipe" (
    "pacienteId" UUID NOT NULL,
    "profissionalId" UUID NOT NULL,

    CONSTRAINT "paciente_equipe_pkey" PRIMARY KEY ("pacienteId","profissionalId")
);

-- CreateTable
CREATE TABLE "vinculo_familiar" (
    "id" UUID NOT NULL,
    "responsavelId" UUID NOT NULL,
    "pacienteId" UUID NOT NULL,
    "parentesco" TEXT NOT NULL,
    "responsavelLegal" BOOLEAN NOT NULL,

    CONSTRAINT "vinculo_familiar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessao" (
    "id" UUID NOT NULL,
    "pacienteId" UUID NOT NULL,
    "profissionalId" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "inicioPrevistoEm" TIMESTAMPTZ(3) NOT NULL,
    "inicio" TIMESTAMPTZ(3),
    "fim" TIMESTAMPTZ(3),
    "local" TEXT NOT NULL,
    "situacao" "situacao_sessao" NOT NULL,
    "statusSync" "status_sync" NOT NULL,

    CONSTRAINT "sessao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registro_atividade" (
    "id" UUID NOT NULL,
    "sessaoId" UUID NOT NULL,
    "objetivoId" UUID NOT NULL,
    "ordem" INTEGER NOT NULL,
    "resultado" "resultado" NOT NULL,
    "ocorridoEm" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "registro_atividade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plano_terapeutico" (
    "id" UUID NOT NULL,
    "pacienteId" UUID NOT NULL,
    "autorId" UUID NOT NULL,
    "status" "situacao_plano" NOT NULL,
    "dataInicio" DATE NOT NULL,
    "dataRevisao" DATE NOT NULL,
    "ultimaRevisaoEm" TIMESTAMPTZ(3),
    "observacaoValidacao" TEXT,

    CONSTRAINT "plano_terapeutico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "objetivo" (
    "id" UUID NOT NULL,
    "planoId" UUID NOT NULL,
    "dominio" TEXT NOT NULL,
    "descricaoTecnica" TEXT NOT NULL,
    "descricaoAcessivel" TEXT NOT NULL,
    "status" "status_objetivo" NOT NULL,
    "dominadoEm" TIMESTAMPTZ(3),
    "percentualAtual" DECIMAL(5,2) NOT NULL,
    "percentualMinimo" INTEGER NOT NULL,
    "sessoesConsecutivas" INTEGER NOT NULL,

    CONSTRAINT "objetivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ocorrencia_comportamental" (
    "id" UUID NOT NULL,
    "pacienteId" UUID NOT NULL,
    "origem" "origem" NOT NULL,
    "ocorridaEm" TIMESTAMPTZ(3) NOT NULL,
    "antecedente" TEXT NOT NULL,
    "comportamento" TEXT NOT NULL,
    "consequencia" TEXT NOT NULL,
    "intensidade" INTEGER NOT NULL,
    "leituraClinicaEm" TIMESTAMPTZ(3),
    "sessaoId" UUID,
    "ocorrenciaEscolarId" UUID,

    CONSTRAINT "ocorrencia_comportamental_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relatorio_evolucao" (
    "id" UUID NOT NULL,
    "pacienteId" UUID NOT NULL,
    "objetivoIds" UUID[],
    "periodoInicio" DATE NOT NULL,
    "periodoFim" DATE NOT NULL,
    "destinatario" "destinatario" NOT NULL,
    "consideracoes" TEXT NOT NULL,
    "autorNome" TEXT NOT NULL,
    "autorRegistro" TEXT NOT NULL,
    "emitidoEm" TIMESTAMPTZ(3) NOT NULL,
    "conteudoEmitido" TEXT NOT NULL,
    "hashConteudo" TEXT NOT NULL,

    CONSTRAINT "relatorio_evolucao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atividade_casa" (
    "id" UUID NOT NULL,
    "pacienteId" UUID NOT NULL,
    "objetivoId" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "passos" TEXT[],
    "dicas" TEXT NOT NULL,
    "frequenciaSemanal" INTEGER NOT NULL,
    "urlVideo" TEXT,
    "ativa" BOOLEAN NOT NULL,
    "prescritaEm" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "atividade_casa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execucao_atividade_casa" (
    "id" UUID NOT NULL,
    "atividadeId" UUID NOT NULL,
    "responsavelId" UUID NOT NULL,
    "dataRealizacao" DATE NOT NULL,
    "desempenho" "desempenho" NOT NULL,
    "observacao" TEXT,

    CONSTRAINT "execucao_atividade_casa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cartao_estrategia" (
    "id" UUID NOT NULL,
    "objetivoId" UUID NOT NULL,
    "tituloSimples" TEXT NOT NULL,
    "oQueFazer" TEXT[],
    "oQueEvitar" TEXT[],
    "sinalAlerta" TEXT NOT NULL,
    "atualizadoEm" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "cartao_estrategia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escola" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "rede" TEXT NOT NULL,
    "municipio" TEXT NOT NULL,

    CONSTRAINT "escola_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consentimento" (
    "id" UUID NOT NULL,
    "responsavelId" UUID NOT NULL,
    "pacienteId" UUID NOT NULL,
    "escolaId" UUID NOT NULL,
    "escopos" "escopo_acesso"[],
    "concedidoEm" TIMESTAMPTZ(3) NOT NULL,
    "validadeAte" DATE NOT NULL,
    "revogadoEm" TIMESTAMPTZ(3),
    "hashTermo" TEXT NOT NULL,

    CONSTRAINT "consentimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "convite_escolar" (
    "id" UUID NOT NULL,
    "consentimentoId" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL,
    "expiraEm" TIMESTAMPTZ(3) NOT NULL,
    "usadoEm" TIMESTAMPTZ(3),

    CONSTRAINT "convite_escolar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vinculo_escolar" (
    "id" UUID NOT NULL,
    "consentimentoId" UUID NOT NULL,
    "conviteId" UUID NOT NULL,
    "pacienteId" UUID NOT NULL,
    "professorId" UUID NOT NULL,
    "turma" TEXT NOT NULL,
    "turno" TEXT NOT NULL,
    "atuacao" TEXT NOT NULL,
    "status" "status_vinculo" NOT NULL,

    CONSTRAINT "vinculo_escolar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ocorrencia_escolar" (
    "id" UUID NOT NULL,
    "vinculoId" UUID NOT NULL,
    "pacienteId" UUID NOT NULL,
    "professorId" UUID NOT NULL,
    "ocorridoEm" TIMESTAMPTZ(3) NOT NULL,
    "registradaEm" TIMESTAMPTZ(3) NOT NULL,
    "corrigidaEm" TIMESTAMPTZ(3),
    "tipo" TEXT NOT NULL,
    "intensidade" INTEGER NOT NULL,
    "contexto" TEXT NOT NULL,

    CONSTRAINT "ocorrencia_escolar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registro_auditoria" (
    "id" UUID NOT NULL,
    "ocorridoEm" TIMESTAMPTZ(3) NOT NULL,
    "usuarioId" UUID,
    "usuarioNome" TEXT,
    "perfil" "perfil",
    "acao" "acao_auditoria" NOT NULL,
    "entidade" TEXT NOT NULL,
    "idEntidade" UUID,
    "pacienteId" UUID,
    "origem" "origem_auditoria" NOT NULL,
    "ipOrigem" TEXT,
    "detalhe" TEXT NOT NULL,
    "valorAnterior" TEXT,

    CONSTRAINT "registro_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ocorrencia_comportamental_ocorrenciaEscolarId_key" ON "ocorrencia_comportamental"("ocorrenciaEscolarId");

-- CreateIndex
CREATE UNIQUE INDEX "convite_escolar_token_key" ON "convite_escolar"("token");

-- CreateIndex
CREATE UNIQUE INDEX "vinculo_escolar_conviteId_key" ON "vinculo_escolar"("conviteId");

-- AddForeignKey
ALTER TABLE "profissional" ADD CONSTRAINT "profissional_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "responsavel" ADD CONSTRAINT "responsavel_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professor_aee" ADD CONSTRAINT "professor_aee_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paciente" ADD CONSTRAINT "paciente_profissionalResponsavelId_fkey" FOREIGN KEY ("profissionalResponsavelId") REFERENCES "profissional"("usuarioId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paciente_equipe" ADD CONSTRAINT "paciente_equipe_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paciente_equipe" ADD CONSTRAINT "paciente_equipe_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "profissional"("usuarioId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vinculo_familiar" ADD CONSTRAINT "vinculo_familiar_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "responsavel"("usuarioId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vinculo_familiar" ADD CONSTRAINT "vinculo_familiar_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessao" ADD CONSTRAINT "sessao_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessao" ADD CONSTRAINT "sessao_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "profissional"("usuarioId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registro_atividade" ADD CONSTRAINT "registro_atividade_sessaoId_fkey" FOREIGN KEY ("sessaoId") REFERENCES "sessao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registro_atividade" ADD CONSTRAINT "registro_atividade_objetivoId_fkey" FOREIGN KEY ("objetivoId") REFERENCES "objetivo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plano_terapeutico" ADD CONSTRAINT "plano_terapeutico_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plano_terapeutico" ADD CONSTRAINT "plano_terapeutico_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "profissional"("usuarioId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objetivo" ADD CONSTRAINT "objetivo_planoId_fkey" FOREIGN KEY ("planoId") REFERENCES "plano_terapeutico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocorrencia_comportamental" ADD CONSTRAINT "ocorrencia_comportamental_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocorrencia_comportamental" ADD CONSTRAINT "ocorrencia_comportamental_sessaoId_fkey" FOREIGN KEY ("sessaoId") REFERENCES "sessao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocorrencia_comportamental" ADD CONSTRAINT "ocorrencia_comportamental_ocorrenciaEscolarId_fkey" FOREIGN KEY ("ocorrenciaEscolarId") REFERENCES "ocorrencia_escolar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relatorio_evolucao" ADD CONSTRAINT "relatorio_evolucao_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atividade_casa" ADD CONSTRAINT "atividade_casa_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atividade_casa" ADD CONSTRAINT "atividade_casa_objetivoId_fkey" FOREIGN KEY ("objetivoId") REFERENCES "objetivo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execucao_atividade_casa" ADD CONSTRAINT "execucao_atividade_casa_atividadeId_fkey" FOREIGN KEY ("atividadeId") REFERENCES "atividade_casa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execucao_atividade_casa" ADD CONSTRAINT "execucao_atividade_casa_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "responsavel"("usuarioId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cartao_estrategia" ADD CONSTRAINT "cartao_estrategia_objetivoId_fkey" FOREIGN KEY ("objetivoId") REFERENCES "objetivo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consentimento" ADD CONSTRAINT "consentimento_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "responsavel"("usuarioId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consentimento" ADD CONSTRAINT "consentimento_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consentimento" ADD CONSTRAINT "consentimento_escolaId_fkey" FOREIGN KEY ("escolaId") REFERENCES "escola"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "convite_escolar" ADD CONSTRAINT "convite_escolar_consentimentoId_fkey" FOREIGN KEY ("consentimentoId") REFERENCES "consentimento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vinculo_escolar" ADD CONSTRAINT "vinculo_escolar_consentimentoId_fkey" FOREIGN KEY ("consentimentoId") REFERENCES "consentimento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vinculo_escolar" ADD CONSTRAINT "vinculo_escolar_conviteId_fkey" FOREIGN KEY ("conviteId") REFERENCES "convite_escolar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vinculo_escolar" ADD CONSTRAINT "vinculo_escolar_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vinculo_escolar" ADD CONSTRAINT "vinculo_escolar_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "professor_aee"("usuarioId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocorrencia_escolar" ADD CONSTRAINT "ocorrencia_escolar_vinculoId_fkey" FOREIGN KEY ("vinculoId") REFERENCES "vinculo_escolar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocorrencia_escolar" ADD CONSTRAINT "ocorrencia_escolar_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocorrencia_escolar" ADD CONSTRAINT "ocorrencia_escolar_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "professor_aee"("usuarioId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registro_auditoria" ADD CONSTRAINT "registro_auditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- Acrescentado a mao: o que o Prisma nao expressa no esquema (docs/01, secao 7).
-- O Prisma nao acompanha CHECK nem trigger, entao nada disto vira divergencia
-- numa proxima migracao.
-- ============================================================================

-- Atributos [1..*]: array com pelo menos um elemento. "IS NOT NULL" porque o
-- Prisma cria a coluna de array sem NOT NULL, e um CHECK que da NULL passa.
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_perfis_nao_vazio"
  CHECK ("perfis" IS NOT NULL AND cardinality("perfis") >= 1);
ALTER TABLE "consentimento" ADD CONSTRAINT "consentimento_escopos_nao_vazio"
  CHECK ("escopos" IS NOT NULL AND cardinality("escopos") >= 1);
ALTER TABLE "atividade_casa" ADD CONSTRAINT "atividade_casa_passos_nao_vazio"
  CHECK ("passos" IS NOT NULL AND cardinality("passos") >= 1);
ALTER TABLE "cartao_estrategia" ADD CONSTRAINT "cartao_estrategia_o_que_fazer_nao_vazio"
  CHECK ("oQueFazer" IS NOT NULL AND cardinality("oQueFazer") >= 1);
ALTER TABLE "cartao_estrategia" ADD CONSTRAINT "cartao_estrategia_o_que_evitar_nao_vazio"
  CHECK ("oQueEvitar" IS NOT NULL AND cardinality("oQueEvitar") >= 1);
-- RelatorioEvolucao "abrange" 1..* Objetivo.
ALTER TABLE "relatorio_evolucao" ADD CONSTRAINT "relatorio_evolucao_objetivo_ids_nao_vazio"
  CHECK ("objetivoIds" IS NOT NULL AND cardinality("objetivoIds") >= 1);

-- Faixas fechadas.
ALTER TABLE "paciente" ADD CONSTRAINT "paciente_nivel_suporte_faixa"
  CHECK ("nivelSuporte" BETWEEN 1 AND 3);
ALTER TABLE "ocorrencia_comportamental" ADD CONSTRAINT "ocorrencia_comportamental_intensidade_faixa"
  CHECK ("intensidade" BETWEEN 1 AND 5);
ALTER TABLE "ocorrencia_escolar" ADD CONSTRAINT "ocorrencia_escolar_intensidade_faixa"
  CHECK ("intensidade" BETWEEN 1 AND 5);
ALTER TABLE "objetivo" ADD CONSTRAINT "objetivo_percentual_atual_faixa"
  CHECK ("percentualAtual" BETWEEN 0 AND 100);
ALTER TABLE "objetivo" ADD CONSTRAINT "objetivo_percentual_minimo_faixa"
  CHECK ("percentualMinimo" BETWEEN 0 AND 100);

-- Tabelas que so crescem: a trilha de auditoria (regra 6) e o documento clinico
-- emitido. UPDATE, DELETE e TRUNCATE sao recusados por quem quer que seja, menos
-- pelo dono da tabela, que pode desligar o trigger — por isso, em producao, a
-- aplicacao conecta com um papel que nao e dono (docs/01, secao 7).
CREATE FUNCTION recusar_alteracao() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'SINCTEA: % em % recusado: registro imutavel', TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'P0001';
END $$;

CREATE TRIGGER registro_auditoria_imutavel BEFORE UPDATE OR DELETE ON "registro_auditoria"
  FOR EACH ROW EXECUTE FUNCTION recusar_alteracao();
CREATE TRIGGER registro_auditoria_sem_truncate BEFORE TRUNCATE ON "registro_auditoria"
  FOR EACH STATEMENT EXECUTE FUNCTION recusar_alteracao();

CREATE TRIGGER relatorio_evolucao_imutavel BEFORE UPDATE OR DELETE ON "relatorio_evolucao"
  FOR EACH ROW EXECUTE FUNCTION recusar_alteracao();
CREATE TRIGGER relatorio_evolucao_sem_truncate BEFORE TRUNCATE ON "relatorio_evolucao"
  FOR EACH STATEMENT EXECUTE FUNCTION recusar_alteracao();
