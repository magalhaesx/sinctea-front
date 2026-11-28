import type { INestApplication } from '@nestjs/common'
import { ModulesContainer } from '@nestjs/core'
import { PATH_METADATA } from '@nestjs/common/constants.js'
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger'
import { CHAVE_AUDITORIA, CHAVE_PERFIS, CHAVE_PUBLICO, type DeclaracaoAuditoria } from '../acesso/metadados.js'

/**
 * O contrato da API em OpenAPI 3 (item 25), gerado do proprio codigo: as
 * rotas dos controladores, e, de cada uma, o que a guarda e o interceptador
 * leem — os perfis que podem chamar, se e publica e o que vai para a trilha.
 * Nada e escrito a mao, e o docs/api/openapi.json versionado e conferido pelo
 * teste servidor/test/openapi.test.ts: mudou a rota, gera-se de novo.
 *
 * Sem exemplo nenhum: nem dado de paciente, nem e-mail, nem senha, nem token.
 *
 * O @nestjs/swagger e dependencia de desenvolvimento: a imagem Docker, que
 * instala so as de producao, nem o tem. A interface interativa so sobe fora de
 * producao (documentacao/interativa.ts).
 */

/** De qual area e cada controlador: a etiqueta da rota no documento. */
const AREA: Record<string, string> = {
  ControladorSaude: 'Saúde',
  ControladorAutenticacao: 'Autenticação',
  ControladorUsuarios: 'Usuários e perfis',
  ControladorTrilhaAdministrativa: 'Trilha administrativa',
  ControladorProfissionais: 'Usuários e perfis',
  ControladorPacientes: 'Pacientes',
  ControladorPlanos: 'Plano e objetivos',
  ControladorOcorrencias: 'Eventos comportamentais',
  ControladorAgenda: 'Agenda',
  ControladorSessoes: 'Sessões',
  ControladorFamilia: 'Família',
  ControladorConsentimentos: 'Consentimento',
  ControladorEscolas: 'Escolas',
  ControladorConvites: 'Convite escolar',
  ControladorAreaEscola: 'Área da escola',
  ControladorAtividades: 'Atividades de casa',
  ControladorRelatorios: 'Relatório de evolução',
  ControladorIndicadores: 'Indicadores',
  ControladorAuditoria: 'Registro de auditoria',
  ControladorTrilha: 'Trilha de autonomia',
}

export const DESCRICAO = [
  'API do SINCTEA — Sistema Integrado de Continuidade Terapêutica no TEA. Trabalho de Conclusão de Curso,',
  'Sistemas de Informação, Centro Universitário FAMETRO.',
  '',
  'A sessão de login é um cookie httpOnly, Secure e SameSite=Lax por vaga do navegador (`sinctea_sessao_1` a',
  '`sinctea_sessao_5`), e cada aba diz a sua vaga no cabeçalho `X-Sinctea-Aba` (item 9).',
  '',
  'Toda rota que lê ou escreve dado do paciente é registrada na trilha de auditoria pelo interceptador, e toda',
  'negativa pelo filtro de erros (regra 6). A descrição de cada operação diz os perfis que podem chamá-la e o que',
  'ela registra. O alcance do perfil (a equipe do paciente, o vínculo da família, o consentimento vigente da',
  'escola) é conferido no serviço, a cada chamada.',
  '',
  'Erros saem como `{ codigo, mensagem, campos, motivo? }`: VALIDACAO 422, NAO_AUTENTICADO 401, ACESSO_NEGADO',
  '403, NAO_ENCONTRADO 404, CONFLITO 409, LIMITE_TENTATIVAS 429 e INDISPONIVEL 503.',
].join('\n')

interface MarcasDaRota { perfis?: string[]; publica: boolean; auditoria?: DeclaracaoAuditoria }

/** As marcas de cada metodo de controlador, lidas como a guarda as le. */
function marcasDasRotas(aplicacao: INestApplication): Map<string, MarcasDaRota> {
  const marcas = new Map<string, MarcasDaRota>()
  for (const modulo of aplicacao.get(ModulesContainer).values()) {
    for (const { metatype } of modulo.controllers.values()) {
      if (!metatype || typeof metatype !== 'function') continue
      const prototipo = metatype.prototype as Record<string, unknown>
      for (const nome of Object.getOwnPropertyNames(prototipo)) {
        const metodo = prototipo[nome]
        if (nome === 'constructor' || typeof metodo !== 'function') continue
        if (Reflect.getMetadata(PATH_METADATA, metodo) === undefined) continue
        const ler = <T>(chave: string): T | undefined => Reflect.getMetadata(chave, metodo) ?? Reflect.getMetadata(chave, metatype)
        marcas.set(`${metatype.name}.${nome}`, {
          perfis: ler<string[]>(CHAVE_PERFIS), publica: ler<boolean>(CHAVE_PUBLICO) ?? false, auditoria: ler<DeclaracaoAuditoria>(CHAVE_AUDITORIA),
        })
      }
    }
  }
  return marcas
}

function descreverAuditoria(d: DeclaracaoAuditoria | undefined): string {
  if (!d) return 'Sem declaração de auditoria: a guarda recusa a rota.'
  if (d.acao === null) return `Não toca dado do paciente; só a negativa entra na trilha (entidade ${d.entidade}).`
  return `Registra ${d.acao} na entidade ${d.entidade}${d.pacienteId ? ', com o paciente' : ''}; a negativa entra como ACESSO_NEGADO.`
}

export function documentoOpenApi(aplicacao: INestApplication, versao: string): OpenAPIObject {
  const configuracao = new DocumentBuilder()
    .setTitle('SINCTEA — API')
    .setDescription(DESCRICAO)
    .setVersion(versao)
    .addCookieAuth('sinctea_sessao_1', {
      type: 'apiKey', in: 'cookie', name: 'sinctea_sessao_1',
      description: 'O cookie da vaga desta aba (sinctea_sessao_1 a sinctea_sessao_5), posto pelo servidor ao entrar.',
    }, 'sessao')
    .addApiKey({ type: 'apiKey', in: 'header', name: 'X-Sinctea-Aba', description: 'O número da vaga desta aba, de 1 a 5 (item 9).' }, 'aba')
    .build()
  const documento = SwaggerModule.createDocument(aplicacao, configuracao, {
    operationIdFactory: (controlador, metodo) => `${controlador}.${metodo}`,
  })

  const marcas = marcasDasRotas(aplicacao)
  for (const caminho of Object.values(documento.paths)) {
    for (const operacao of Object.values(caminho)) {
      if (!operacao || typeof operacao !== 'object' || !('operationId' in operacao)) continue
      const id = String(operacao.operationId)
      const marca = marcas.get(id)
      if (!marca) throw new Error(`Rota sem marcas lidas: ${id}`)
      operacao.tags = [AREA[id.split('.')[0]] ?? id.split('.')[0]]
      operacao.security = marca.publica ? [] : [{ sessao: [], aba: [] }]
      for (const resposta of Object.values(operacao.responses ?? {})) {
        if (resposta && typeof resposta === 'object' && 'description' in resposta && !resposta.description) resposta.description = 'Sucesso.'
      }
      operacao.description = [
        marca.publica ? 'Pública: não pede sessão.' : marca.perfis ? `Perfis: ${marca.perfis.join(', ')}.` : 'Qualquer perfil com sessão.',
        descreverAuditoria(marca.auditoria),
      ].join(' ')
    }
  }
  return documento
}
