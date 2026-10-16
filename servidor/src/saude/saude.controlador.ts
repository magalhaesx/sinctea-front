import { Controller, Get, ServiceUnavailableException } from '@nestjs/common'
import { frequenciaEmLinguagemCotidiana } from '@sinctea/compartilhado/dominio/regras'
import { Publico, SemDadoDoPaciente } from '../acesso/metadados.js'
import { ServicoBanco } from '../banco/servico-banco.js'

/**
 * GET /api/saude
 *
 * Diz se o servidor esta de pe, se le o banco — o nome da ultima migracao
 * aplicada — e se roda o mesmo dominio do front. Nunca devolve contagem nem
 * registro: a rota e publica.
 */
@Controller('saude')
export class ControladorSaude {
  constructor(private readonly banco: ServicoBanco) {}

  @Get()
  @Publico()
  @SemDadoDoPaciente('Saude')
  async verificar() {
    let migracao: string | null
    try {
      migracao = await this.banco.ultimaMigracaoAplicada()
    } catch {
      // O motivo fica no servidor: a resposta nao descreve a infraestrutura.
      throw new ServiceUnavailableException('O banco de dados não respondeu.')
    }
    return {
      situacao: 'no ar',
      banco: { migracao },
      dominio: {
        funcao: 'frequenciaEmLinguagemCotidiana',
        entrada: 70,
        saida: frequenciaEmLinguagemCotidiana(70),
      },
    }
  }
}
