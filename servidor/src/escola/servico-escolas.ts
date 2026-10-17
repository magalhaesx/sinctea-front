import { Injectable } from '@nestjs/common'
import { ErroServico, REDES_DE_ENSINO, type Escola, type FiltroPaginacao, type Pagina } from '@sinctea/compartilhado'
import { escolaParecida, paraBusca } from '@sinctea/compartilhado/dominio/regras'
import { ServicoBanco } from '../banco/servico-banco.js'
import { paginar, porNome } from '../http/paginacao.js'
import { exigirValido, textoOuVazio } from '../http/validacao.js'

/**
 * Escolas. Listar, para escolher no consentimento; e, pela familia, cadastrar
 * a que nao esta na lista (docs/07, secao 0, lacuna 4) — depois de ver as
 * parecidas do mesmo municipio, para nao duplicar.
 */
@Injectable()
export class ServicoEscolas {
  constructor(private readonly banco: ServicoBanco) {}

  async listar(filtro: FiltroPaginacao): Promise<Pagina<Escola>> {
    return paginar((await this.banco.escola.findMany()).sort(porNome), { porPagina: 100, ...filtro })
  }

  async parecidas(nome: unknown, municipio: unknown): Promise<Escola[]> {
    const n = textoOuVazio(nome)
    const m = textoOuVazio(municipio)
    if (!n || !m) return []
    return (await this.banco.escola.findMany()).filter((e) => escolaParecida(n, m, e)).sort(porNome)
  }

  async cadastrar(dados: Record<string, unknown>): Promise<Escola> {
    const nome = textoOuVazio(dados.nome).replace(/\s+/g, ' ')
    const municipio = textoOuVazio(dados.municipio).replace(/\s+/g, ' ')
    const rede = REDES_DE_ENSINO.find((r) => paraBusca(r) === paraBusca(textoOuVazio(dados.rede)))
    const erros: Record<string, string> = {}
    if (!nome) erros.nome = 'Escreva o nome da escola.'
    if (!rede) erros.rede = 'Escolha a rede de ensino.'
    if (!municipio) erros.municipio = 'Escreva o município.'
    exigirValido(erros)
    // A mesma escola, escrita igual, no mesmo municipio: e a que ja existe.
    const iguais = (await this.banco.escola.findMany())
      .filter((e) => paraBusca(e.nome) === paraBusca(nome) && paraBusca(e.municipio) === paraBusca(municipio))
    if (iguais.length > 0) {
      throw new ErroServico('CONFLITO', 'Esta escola já está cadastrada. Escolha-a na lista.', { nome: 'Esta escola já está cadastrada. Escolha-a na lista.' })
    }
    return this.banco.escola.create({ data: { nome, rede: rede!, municipio } })
  }
}
