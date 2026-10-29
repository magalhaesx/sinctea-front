import { Injectable } from '@nestjs/common'
import {
  ErroServico, type ConteudoRelatorio, type DataCivil, type Destinatario, type FiltroPaginacao, type Pagina,
  type PedidoRelatorio, type RelatorioEvolucao,
} from '@sinctea/compartilhado'
import { diaCivilEm } from '@sinctea/compartilhado/dominio/datas'
import { jsonCanonico, resumoSha256 } from '@sinctea/compartilhado/dominio/hash'
import {
  montarConteudoRelatorio, SEM_REGISTRO_NO_CONSELHO, validarPedidoRelatorio,
} from '@sinctea/compartilhado/dominio/relatorio'
import type { RelatorioEvolucao as LinhaRelatorio } from '../gerado/client.js'
import { ServicoBanco } from '../banco/servico-banco.js'
import { exigirPacienteClinico } from '../clinica/alcance.js'
import { deDataCivil, paraDataCivil, paraObjetivo } from '../clinica/mapeadores.js'
import type { DoPaciente } from '../clinica/servico-planos.js'
import type { SessaoServidor } from '../http/tipos-http.js'
import { exigirUuid, exigirValido } from '../http/validacao.js'

/**
 * Relatorio de evolucao (UC09, telas 10 e 10b; item 18), portado de
 * src/servicos/mock/relatorios.ts. A validacao do pedido e a montagem do
 * conteudo sao as do compartilhado (dominio/relatorio.ts), as mesmas do mock e
 * da semente. So a equipe do paciente e a coordenacao alcancam: professor,
 * responsavel e administrador nunca (regra 3).
 *
 * O emitido nao muda: conteudoEmitido e o jsonCanonico exato do conteudo,
 * gravado como texto, e hashConteudo e o sha256 desse mesmo texto. obter le o
 * conteudo desse texto, e a tela 10b refaz o resumo no navegador. Nao ha
 * rota de editar nem de excluir, e o trigger do banco recusa UPDATE e DELETE.
 */
@Injectable()
export class ServicoRelatorios {
  constructor(private readonly banco: ServicoBanco) {}

  /** O conteudo de agora: o plano, as sessoes encerradas e a montagem do compartilhado. */
  private async montar(pacienteId: string, pedido: PedidoRelatorio): Promise<ConteudoRelatorio> {
    const [paciente, plano, sessoes] = await Promise.all([
      this.banco.paciente.findUniqueOrThrow({ where: { id: pacienteId }, select: { id: true, nome: true, dataNascimento: true } }),
      this.banco.planoTerapeutico.findFirst({ where: { pacienteId }, include: { objetivos: true } }),
      this.banco.sessao.findMany({
        where: { pacienteId, situacao: 'ENCERRADA' },
        select: {
          numero: true, situacao: true, inicio: true,
          registros: { select: { id: true, objetivoId: true, ordem: true, resultado: true, ocorridoEm: true } },
        },
      }),
    ])
    return montarConteudoRelatorio({
      paciente: { ...paciente, dataNascimento: paraDataCivil(paciente.dataNascimento) },
      plano: plano ? { status: plano.status, objetivos: plano.objetivos.map(paraObjetivo) } : null,
      sessoes: sessoes.map((s) => ({
        ...s, inicio: s.inicio?.toISOString() ?? null,
        registros: s.registros.map((r) => ({ ...r, ocorridoEm: r.ocorridoEm.toISOString() })),
      })),
      pedido,
    })
  }

  /** A previa le as sessoes do paciente: o controlador a registra como leitura. */
  async previsualizar(sessao: SessaoServidor, pacienteId: string, corpo: unknown): Promise<ConteudoRelatorio> {
    const paciente = await exigirPacienteClinico(this.banco, sessao, pacienteId)
    const pedido = lerPedido(corpo)
    exigirValido(validarPedidoRelatorio(pedido, diaCivilEm(new Date()), { emitir: false }))
    return this.montar(paciente.id, pedido)
  }

  async emitir(sessao: SessaoServidor, pacienteId: string, corpo: unknown): Promise<RelatorioEvolucao> {
    const paciente = await exigirPacienteClinico(this.banco, sessao, pacienteId)
    const pedido = lerPedido(corpo)
    exigirValido(validarPedidoRelatorio(pedido, diaCivilEm(new Date()), { emitir: true }))
    // Documento clinico emitido carrega o registro no conselho de quem assina,
    // e o sistema nao o inventa: sem ele, nao se emite.
    const autor = await this.banco.profissional.findUnique({ where: { usuarioId: sessao.usuario.id } })
    const registro = autor?.registroConselho?.trim() ?? ''
    if (!registro) throw new ErroServico('CONFLITO', SEM_REGISTRO_NO_CONSELHO)

    const conteudo = await this.montar(paciente.id, pedido)
    const texto = jsonCanonico(conteudo)
    const criado = await this.banco.relatorioEvolucao.create({ data: {
      pacienteId: paciente.id,
      objetivoIds: conteudo.objetivos.map((o) => o.objetivoId),
      periodoInicio: deDataCivil(conteudo.periodoInicio),
      periodoFim: deDataCivil(conteudo.periodoFim),
      destinatario: conteudo.destinatario,
      consideracoes: conteudo.consideracoes,
      // Fotografia de quem assina: nunca resolvida pelo Usuario na leitura.
      autorNome: sessao.usuario.nome,
      autorRegistro: registro,
      emitidoEm: new Date(),
      conteudoEmitido: texto,
      hashConteudo: await resumoSha256(conteudo),
    } })
    return paraRelatorio(criado)
  }

  async listarPorPaciente(sessao: SessaoServidor, pacienteId: string, filtro: FiltroPaginacao): Promise<Pagina<RelatorioEvolucao>> {
    const paciente = await exigirPacienteClinico(this.banco, sessao, pacienteId)
    const porPagina = Math.min(100, Math.max(1, Math.floor(filtro.porPagina ?? 10)))
    const pagina = Math.max(1, Math.floor(filtro.pagina ?? 1))
    const where = { pacienteId: paciente.id }
    const [total, linhas] = await Promise.all([
      this.banco.relatorioEvolucao.count({ where }),
      this.banco.relatorioEvolucao.findMany({
        where, orderBy: [{ emitidoEm: 'desc' }, { id: 'desc' }], skip: (pagina - 1) * porPagina, take: porPagina,
      }),
    ])
    return { itens: linhas.map(paraRelatorio), total, pagina, porPagina }
  }

  async obter(sessao: SessaoServidor, relatorioId: string): Promise<DoPaciente<RelatorioEvolucao>> {
    const linha = await this.banco.relatorioEvolucao.findUnique({ where: { id: exigirUuid(relatorioId, 'Relatório') } })
    if (!linha) throw new ErroServico('NAO_ENCONTRADO', 'Relatório não encontrado.')
    await exigirPacienteClinico(this.banco, sessao, linha.pacienteId)
    return { resultado: paraRelatorio(linha), pacienteId: linha.pacienteId }
  }
}

/** O corpo como pedido, com cada campo do tipo certo; o que nao for vira vazio, e a validacao recusa. */
function lerPedido(corpo: unknown): PedidoRelatorio {
  const c = (corpo ?? {}) as Record<string, unknown>
  const texto = (v: unknown) => (typeof v === 'string' ? v : '')
  return {
    periodoInicio: texto(c.periodoInicio) as DataCivil,
    periodoFim: texto(c.periodoFim) as DataCivil,
    objetivoIds: Array.isArray(c.objetivoIds) ? c.objetivoIds.map(texto) : [],
    destinatario: texto(c.destinatario) as Destinatario,
    consideracoes: texto(c.consideracoes),
  }
}

/** O conteudo e lido do texto gravado, e nao montado de novo: e o documento como saiu. */
function paraRelatorio(l: LinhaRelatorio): RelatorioEvolucao {
  return {
    id: l.id, pacienteId: l.pacienteId, objetivoIds: l.objetivoIds,
    periodoInicio: paraDataCivil(l.periodoInicio), periodoFim: paraDataCivil(l.periodoFim),
    destinatario: l.destinatario, consideracoes: l.consideracoes, autorNome: l.autorNome, autorRegistro: l.autorRegistro,
    emitidoEm: l.emitidoEm.toISOString(),
    conteudoEmitido: JSON.parse(l.conteudoEmitido) as ConteudoRelatorio,
    hashConteudo: l.hashConteudo,
  }
}
