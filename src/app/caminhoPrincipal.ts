import { usandoApi } from '../servicos'

/**
 * So o caminho principal (docs/07, secao 0), na versao publicada e no
 * desenvolvimento contra a API: indicadores, relatorios, atividades de casa,
 * evolucao, a tela de auditoria, a agenda e o registro de ocorrencia na sessao
 * somem da navegacao e das rotas ate o servico de cada um chegar ao servidor.
 * Nunca aparecem com dado simulado. Os avisos da escola e os eventos
 * comportamentais da ficha voltaram com o item 6.
 *
 * Com o mock — desenvolvimento sem VITE_API_URL e testes —, tudo continua.
 * No build, a condicao vira constante, e o que ela esconde nem entra no pacote.
 */
export const SO_CAMINHO_PRINCIPAL = usandoApi
