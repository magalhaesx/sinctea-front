-- Sessao de login e link de primeiro acesso (docs/07, D5 e secao 0).
-- Os dois guardam so o resumo SHA-256 do token. O sinctea_app ganha os
-- privilegios das duas tabelas pelo ALTER DEFAULT PRIVILEGES do papel.

-- CreateTable
CREATE TABLE "sessao_login" (
    "id" UUID NOT NULL,
    "tokenResumo" TEXT NOT NULL,
    "usuarioId" UUID NOT NULL,
    "perfilAtivo" "perfil" NOT NULL,
    "criadaEm" TIMESTAMPTZ(3) NOT NULL,
    "expiraEm" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sessao_login_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acesso_inicial" (
    "id" UUID NOT NULL,
    "tokenResumo" TEXT NOT NULL,
    "usuarioId" UUID NOT NULL,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL,
    "expiraEm" TIMESTAMPTZ(3) NOT NULL,
    "usadoEm" TIMESTAMPTZ(3),

    CONSTRAINT "acesso_inicial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sessao_login_tokenResumo_key" ON "sessao_login"("tokenResumo");

-- CreateIndex
CREATE INDEX "sessao_login_usuarioId_idx" ON "sessao_login"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "acesso_inicial_tokenResumo_key" ON "acesso_inicial"("tokenResumo");

-- CreateIndex
CREATE INDEX "acesso_inicial_usuarioId_idx" ON "acesso_inicial"("usuarioId");

-- AddForeignKey
ALTER TABLE "sessao_login" ADD CONSTRAINT "sessao_login_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acesso_inicial" ADD CONSTRAINT "acesso_inicial_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- O e-mail fica gravado em minusculas. Com o indice unico que ja existe, a
-- unicidade passa a valer sem diferenca de maiusculas: "Ana@x" e "ana@x" nao
-- sao duas contas. Um CHECK, e nao um indice sobre lower(email), porque o
-- Prisma nao representa indice de expressao e acusaria diferenca no esquema.
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_email_minusculo"
  CHECK ("email" = lower("email"));

ALTER TABLE "sessao_login" ADD CONSTRAINT "sessao_login_token_resumo_sha256"
  CHECK ("tokenResumo" ~ '^[0-9a-f]{64}$');
ALTER TABLE "sessao_login" ADD CONSTRAINT "sessao_login_expira_depois"
  CHECK ("expiraEm" > "criadaEm");

ALTER TABLE "acesso_inicial" ADD CONSTRAINT "acesso_inicial_token_resumo_sha256"
  CHECK ("tokenResumo" ~ '^[0-9a-f]{64}$');
ALTER TABLE "acesso_inicial" ADD CONSTRAINT "acesso_inicial_expira_depois"
  CHECK ("expiraEm" > "criadoEm");
