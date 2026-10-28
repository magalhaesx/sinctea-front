-- Item 15: um registro por atividade de casa por dia, no dia civil de Manaus
-- (dataRealizacao e date, gravada com diaCivilEm). Sem isto, a familia que
-- tocasse duas vezes contaria duas na adesao da tela 9. O segundo registro do
-- dia e recusado aqui mesmo com dois pedidos ao mesmo tempo.

-- CreateIndex
CREATE UNIQUE INDEX "execucao_atividade_casa_atividadeId_dataRealizacao_key" ON "execucao_atividade_casa"("atividadeId", "dataRealizacao");
