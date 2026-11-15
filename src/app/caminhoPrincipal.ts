import { usandoApi } from '../servicos'

/**
 * So o caminho principal (docs/07, secao 0), na versao publicada e no
 * desenvolvimento contra a API: a agenda some da tela ate o servico dela
 * chegar ao servidor. Nunca aparece com dado simulado. Os avisos da escola e
 * os eventos comportamentais da ficha voltaram com o item 6; o registro de
 * ocorrencia na sessao, com o 7; as atividades de casa (telas 9 e 16, e o
 * bloco da tela 15), com o 15; a evolucao por objetivo (tela 8), com o 16; o
 * registro de auditoria (tela 13), com o 17; o relatorio de evolucao (telas
 * 10 e 10b), com o 18; os indicadores da coordenacao (tela 11), com o 19.
 *
 * Com o mock — desenvolvimento sem VITE_API_URL e testes —, tudo continua.
 * No build, a condicao vira constante, e o que ela esconde nem entra no pacote.
 */
export const SO_CAMINHO_PRINCIPAL = usandoApi
