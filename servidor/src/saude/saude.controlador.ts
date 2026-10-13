import { Controller, Get } from '@nestjs/common'
import { frequenciaEmLinguagemCotidiana } from '@sinctea/compartilhado/dominio/regras'

/**
 * GET /api/saude
 *
 * Por enquanto, so a prova de que o servidor roda o MESMO dominio do front: a
 * frase vem de compartilhado/, e nao de uma copia. Quando o banco entrar
 * (Etapa 9, passo 4), esta rota passa a responder lendo o banco.
 */
@Controller('saude')
export class ControladorSaude {
  @Get()
  verificar() {
    return {
      situacao: 'no ar',
      dominio: {
        funcao: 'frequenciaEmLinguagemCotidiana',
        entrada: 70,
        saida: frequenciaEmLinguagemCotidiana(70),
      },
    }
  }
}
