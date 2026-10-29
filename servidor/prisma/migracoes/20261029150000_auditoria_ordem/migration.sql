-- Item 17b: a ordem da tela 13 (ocorridoEm e id, do mais recente). Sem este
-- indice, cada pagina da trilha sem filtro ordenava a tabela inteira.

-- CreateIndex
CREATE INDEX "registro_auditoria_ocorridoEm_id_idx" ON "registro_auditoria"("ocorridoEm" DESC, "id" DESC);
