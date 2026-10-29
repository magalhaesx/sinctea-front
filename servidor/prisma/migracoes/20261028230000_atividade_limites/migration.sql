-- Item 15b: os limites da atividade de casa tambem no banco. A validacao e
-- validarNovaAtividadeCasa, no compartilhado, a mesma na tela e no servidor;
-- estes CHECKs recusam o que chegar por fora dela. Os limites sao os de
-- LIMITES_ATIVIDADE_CASA (compartilhado/src/dominio/regras.ts): mudou la,
-- muda aqui, numa migracao nova.
--
-- O banco nao confere os 300 caracteres de cada passo: CHECK nao percorre
-- array sem funcao propria, e o dominio ja confere.

-- DropIndex
-- O indice unico (atividadeId, dataRealizacao), do item 15, comeca pela
-- atividade e serve tambem a busca so por ela.
DROP INDEX "execucao_atividade_casa_atividadeId_idx";

-- Passos: de 1 a 10, no lugar do "pelo menos um" da migracao inicial.
ALTER TABLE "atividade_casa" DROP CONSTRAINT "atividade_casa_passos_nao_vazio";
ALTER TABLE "atividade_casa" ADD CONSTRAINT "atividade_casa_passos_faixa"
  CHECK ("passos" IS NOT NULL AND cardinality("passos") BETWEEN 1 AND 10);

ALTER TABLE "atividade_casa" ADD CONSTRAINT "atividade_casa_frequencia_semanal_faixa"
  CHECK ("frequenciaSemanal" BETWEEN 1 AND 7);

-- O video so com https://: um "javascript:" executaria codigo na tela de quem
-- tocasse no link. starts_with diferencia maiusculas, como o dominio.
ALTER TABLE "atividade_casa" ADD CONSTRAINT "atividade_casa_url_video_https"
  CHECK ("urlVideo" IS NULL OR (starts_with("urlVideo", 'https://') AND char_length("urlVideo") <= 500));

ALTER TABLE "atividade_casa" ADD CONSTRAINT "atividade_casa_titulo_tamanho"
  CHECK (char_length("titulo") BETWEEN 1 AND 120);
ALTER TABLE "atividade_casa" ADD CONSTRAINT "atividade_casa_descricao_tamanho"
  CHECK (char_length("descricao") <= 1000);
ALTER TABLE "atividade_casa" ADD CONSTRAINT "atividade_casa_dicas_tamanho"
  CHECK (char_length("dicas") <= 1000);

ALTER TABLE "execucao_atividade_casa" ADD CONSTRAINT "execucao_atividade_casa_observacao_tamanho"
  CHECK ("observacao" IS NULL OR char_length("observacao") <= 500);
