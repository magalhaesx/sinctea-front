import { usandoApi } from '../servicos'

/**
 * So o caminho principal (docs/07, secao 0), na versao publicada e no
 * desenvolvimento contra a API: indicadores, relatorios, atividades de casa,
 * ocorrencias comportamentais, evolucao, avisos da escola, a tela de auditoria
 * e a agenda somem da navegacao e das rotas ate o servico de cada um chegar
 * ao servidor. Nunca aparecem com dado simulado.
 *
 * Com o mock — desenvolvimento sem VITE_API_URL e testes —, tudo continua.
 * No build, a condicao vira constante, e o que ela esconde nem entra no pacote.
 */
export const SO_CAMINHO_PRINCIPAL = usandoApi
