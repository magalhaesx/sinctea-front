import { Injectable } from '@nestjs/common'
import type { RegistroAuditoria } from '@sinctea/compartilhado'
import { origemDoPerfil } from '@sinctea/compartilhado/dominio/auditoria'
import { ServicoBanco } from '../banco/servico-banco.js'
import type { SessaoServidor } from '../http/tipos-http.js'

export interface EventoAuditoria {
  acao: RegistroAuditoria['acao']
  entidade: string
  idEntidade?: string | null
  pacienteId?: string | null
  detalhe: string
  /** So quando houve versao anterior a preservar. Ver RegistroAuditoria. */
  valorAnterior?: string | null
  ipOrigem?: string | null
}

/**
 * A trilha de auditoria (regra 6). So acrescenta: o trigger do banco recusa
 * UPDATE, DELETE e TRUNCATE, e o papel da aplicacao nao pode desliga-lo.
 *
 * Quem chama e o interceptador, para leitura e escrita de dado do paciente, e
 * o filtro de erros, para a negativa. Os servicos so chamam direto o que nao
 * passa por rota com sessao, como o primeiro acesso.
 */
@Injectable()
export class ServicoAuditoria {
  constructor(private readonly banco: ServicoBanco) {}

  async registrar(sessao: SessaoServidor | null, evento: EventoAuditoria): Promise<void> {
    const perfil = sessao?.perfilAtivo ?? null
    // As colunas sao uuid. Um id que nao e uuid — o de uma tentativa com
    // parametro inventado — vai para o detalhe, e a negativa nao se perde.
    const idEntidade = comoUuid(evento.idEntidade)
    const pacienteId = comoUuid(evento.pacienteId)
    const sobra = [
      evento.idEntidade && !idEntidade ? `id informado: ${evento.idEntidade.slice(0, 80)}` : null,
      evento.pacienteId && !pacienteId ? `paciente informado: ${evento.pacienteId.slice(0, 80)}` : null,
    ].filter(Boolean)
    await this.banco.registroAuditoria.create({ data: {
      ocorridoEm: new Date(),
      usuarioId: sessao?.usuario.id ?? null,
      usuarioNome: sessao?.usuario.nome ?? null,
      perfil,
      acao: evento.acao,
      entidade: evento.entidade,
      idEntidade,
      pacienteId,
      origem: origemDoPerfil(perfil),
      ipOrigem: evento.ipOrigem ?? null,
      detalhe: sobra.length > 0 ? `${evento.detalhe} (${sobra.join('; ')})` : evento.detalhe,
      valorAnterior: evento.valorAnterior ?? null,
    } })
  }
}

const FORMATO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function comoUuid(valor: string | null | undefined): string | null {
  return valor && FORMATO_UUID.test(valor) ? valor.toLowerCase() : null
}
