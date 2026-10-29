import { usandoApi } from '../servicos'

/**
 * So o caminho principal (docs/07, secao 0), na versao publicada e no
 * desenvolvimento contra a API: indicadores, relatorios, a tela de auditoria e
 * a agenda somem da navegacao e das rotas ate o servico de cada um chegar ao
 * servidor. Nunca aparecem com dado simulado. Os avisos da escola e os eventos
 * comportamentais da ficha voltaram com o item 6; o registro de ocorrencia na
 * sessao, com o 7; as atividades de casa (telas 9 e 16, e o bloco da tela 15),
 * com o 15; a evolucao por objetivo (tela 8), com o 16.
 *
 * Com o mock — desenvolvimento sem VITE_API_URL e testes —, tudo continua.
 * No build, a condicao vira constante, e o que ela esconde nem entra no pacote.
 */
export const SO_CAMINHO_PRINCIPAL = usandoApi
