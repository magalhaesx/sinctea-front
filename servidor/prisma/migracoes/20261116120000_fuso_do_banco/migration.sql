-- Item 19c: o banco em UTC, gravado no proprio banco.
--
-- O adaptador pg do Prisma (7.10.0) manda o instante como relogio de UTC, sem
-- o deslocamento ("2026-11-17 03:30:00"), e o PostgreSQL o le no TimeZone da
-- sessao; na leitura, troca o deslocamento recebido por +00:00. O instante so
-- vai e volta certo com a sessao em UTC. Ate aqui, isso dependia do padrao do
-- servidor; daqui em diante, toda sessao nova neste banco nasce em UTC, venha
-- pela conexao direta ou pelo pooler, sem opcao de conexao nem SET por sessao.
-- A /api/saude confere o deslocamento e responde 503 se nao for zero.
--
-- ALTER DATABASE ... SET exige os privilegios do dono do banco. No Neon, quem
-- aplica as migracoes e o dono do banco (docs/07); quem nao for e recusado
-- aqui, antes de qualquer mudanca. Vale para as sessoes que abrirem depois:
-- a que ja estava aberta continua com o fuso com que nasceu.

DO $$
BEGIN
  IF NOT pg_has_role(current_user, (SELECT datdba FROM pg_database WHERE datname = current_database()), 'USAGE') THEN
    RAISE EXCEPTION 'A migracao fuso_do_banco precisa ser aplicada pelo dono do banco.';
  END IF;
  EXECUTE format('ALTER DATABASE %I SET timezone TO %L', current_database(), 'UTC');
END $$;
