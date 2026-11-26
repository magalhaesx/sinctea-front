import { Injectable } from '@nestjs/common'
import type { TrilhaAutonomia } from '@sinctea/compartilhado'
import { montarTrilha } from '@sinctea/compartilhado/dominio/trilha'
import { ServicoBanco } from '../banco/servico-banco.js'
import { exigirPacienteClinico } from '../clinica/alcance.js'
import { exigirPacienteDaFamilia } from '../familia/acesso-familia.js'
import type { SessaoServidor } from '../http/tipos-http.js'

/**
 * Trilha de autonomia (item 24; objetivo 5.6 do pre-projeto). A mesma
 * resposta pela clinica e pela familia, montada por montarTrilha, a mesma do
 * mock. So o plano vigente, e o texto como a equipe o escreveu (regra 4).
 *
 * A leitura do banco ja e o recorte: do objetivo saem so o id, a redacao
 * acessivel, a situacao e a data do dominio; do cartao, so o que ele diz. A
 * redacao tecnica, o dominio e o percentual nem sao lidos.
 */
@Injectable()
export class ServicoTrilha {
  constructor(private readonly banco: ServicoBanco) {}

  /** A equipe do paciente e a coordenacao. */
  async daClinica(sessao: SessaoServidor, pacienteId: string): Promise<TrilhaAutonomia> {
    return this.montar(await exigirPacienteClinico(this.banco, sessao, pacienteId))
  }

  /** Qualquer responsavel vinculado, legal ou nao: ler nao amplia o acesso de ninguem. */
  async daFamilia(sessao: SessaoServidor, pacienteId: string): Promise<TrilhaAutonomia> {
    const { paciente } = await exigirPacienteDaFamilia(this.banco, sessao, pacienteId)
    return this.montar(paciente)
  }

  private async montar(paciente: { id: string; nome: string }): Promise<TrilhaAutonomia> {
    const plano = await this.banco.planoTerapeutico.findFirst({
      where: { pacienteId: paciente.id, status: 'VIGENTE' },
      select: {
        status: true,
        objetivos: {
          select: {
            id: true, descricaoAcessivel: true, status: true, dominadoEm: true,
            cartoes: { select: { id: true, tituloSimples: true, oQueFazer: true, oQueEvitar: true, sinalAlerta: true } },
          },
        },
      },
    })
    return montarTrilha({
      paciente: { id: paciente.id, nome: paciente.nome },
      plano: plano && {
        status: plano.status,
        objetivos: plano.objetivos.map((o) => ({ ...o, dominadoEm: o.dominadoEm?.toISOString() ?? null })),
      },
      agora: new Date(),
    })
  }
}
