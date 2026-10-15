-- O papel com que a aplicacao conecta ao banco (docs/07, D4). Modelo
-- versionado: o arquivo de verdade, papel-aplicacao.sql, tem a senha e fica
-- fora do git.
--
-- Roda uma vez, no SQL Editor do Neon, como neondb_owner, DEPOIS das
-- migracoes: o GRANT em ALL TABLES vale para as tabelas que ja existem, e o
-- ALTER DEFAULT PRIVILEGES, para as que o dono criar depois.
--
-- O papel nao e dono de nada. So le e escreve linha: nao cria tabela, nao da
-- TRUNCATE e nao desliga trigger. A imutabilidade da auditoria e do relatorio
-- emitido depende disso — o dono poderia desligar o trigger. O teste e
-- servidor/test/papel.test.ts, que roda este arquivo.

CREATE ROLE sinctea_app WITH LOGIN PASSWORD '<senha>';
GRANT CONNECT ON DATABASE neondb TO sinctea_app;
GRANT USAGE ON SCHEMA public TO sinctea_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sinctea_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sinctea_app;
