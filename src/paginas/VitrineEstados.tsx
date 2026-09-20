import { useEffect, useId, useRef, useState } from 'react'
import { Tela } from '../app/LayoutApp'
import { Botao, Etiqueta, Titulo } from '../componentes/ui'
import { descricaoNivelSuporte } from '../dominio/regras'
import { ErroServico, servicos, type Pagina, type PacienteResumo } from '../servicos'
import { EstadoCarregando } from '../ui/EstadoCarregando'
import { EstadoErro } from '../ui/EstadoErro'
import { EstadoVazio } from '../ui/EstadoVazio'
import { Paginacao } from '../ui/Paginacao'
import { Tabela, type Coluna } from '../ui/Tabela'

/**
 * VITRINE DE DESENVOLVIMENTO — rota /dev/estados, existe apenas em `npm run dev`.
 * Mostra os quatro estados lado a lado (conferencia da etapa 2 do roteiro).
 * Os dados vem da camada de servicos, como em qualquer tela.
 */

const colunas: Coluna<PacienteResumo>[] = [
  { id: 'nome', titulo: 'Paciente', celula: (p) => p.nome },
  { id: 'idade', titulo: 'Idade', numerica: true, celula: (p) => `${p.idade} anos` },
  { id: 'nivel', titulo: 'Nível de suporte', celula: (p) => descricaoNivelSuporte(p.nivelSuporte) },
  { id: 'prof', titulo: 'Profissional', celula: (p) => p.profissionalResponsavel.nome },
  {
    id: 'plano', titulo: 'Plano',
    celula: (p) => p.situacaoPlano === 'VIGENTE'
      ? <Etiqueta tom="ok" simbolo="✓">Vigente</Etiqueta>
      : <Etiqueta tom="at" simbolo="▲">{p.situacaoPlano === 'SEM_PLANO' ? 'Sem plano' : 'Pendente'}</Etiqueta>,
  },
  {
    id: 'ultima', titulo: 'Última sessão', numerica: true,
    celula: (p) => p.ultimaSessaoEm ? new Date(p.ultimaSessaoEm).toLocaleDateString('pt-BR') : '—',
  },
]

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; erro: unknown }
  | { tipo: 'pronto'; dados: Pagina<PacienteResumo>; atualizando: boolean }

function Painel({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  const id = useId()
  return (
    <section className="flex min-w-0 flex-col gap-3" aria-labelledby={id}>
      <h2 id={id} className="text-[13.5px] font-bold uppercase tracking-wider text-tinta2">{titulo}</h2>
      {children}
    </section>
  )
}

export function VitrineEstados() {
  const [pagina, setPagina] = useState(1)
  const [tentativa, setTentativa] = useState(0)
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' })
  // Lido no disparo da carga; um ref evita que ligar a falha dispare outra carga.
  const falharProxima = useRef(false)

  useEffect(() => {
    let ativo = true
    // Troca de pagina mantem as linhas atuais visiveis, esmaecidas.
    setEstado((e) => (e.tipo === 'pronto' ? { ...e, atualizando: true } : { tipo: 'carregando' }))
    const falhar = falharProxima.current
    falharProxima.current = false

    const carregar = async () => {
      if (falhar) throw new ErroServico('INDISPONIVEL', 'Falha provocada pela vitrine.')
      // A vitrine entra como coordenadora para enxergar os cinco pacientes.
      const sessao = await servicos.autenticacao.sessaoAtual()
      if (sessao?.perfilAtivo !== 'COORDENADOR') await servicos.autenticacao.entrarDemonstracao('COORDENADOR')
      return servicos.pacientes.listar({ pagina, porPagina: 2 })
    }
    carregar()
      .then((dados) => { if (ativo) setEstado({ tipo: 'pronto', dados, atualizando: false }) })
      .catch((erro) => { if (ativo) setEstado({ tipo: 'erro', erro }) })
    return () => { ativo = false }
  }, [pagina, tentativa])

  const recarregar = (falhar = false) => {
    falharProxima.current = falhar
    setEstado({ tipo: 'carregando' })
    setTentativa((t) => t + 1)
  }

  return (
    <Tela area="neutro" caminho={['Desenvolvimento', 'Vitrine de estados']}>
      <Titulo sub="Os quatro estados obrigatórios de todo componente que busca dados (docs/02, seção 4)">
        Vitrine de estados
      </Titulo>

      <div className="grid gap-6 lg:grid-cols-2">
        <Painel titulo="Carregando">
          <EstadoCarregando forma="tabela" colunas={4} linhas={2} rotulo="Carregando a lista de pacientes" />
          <EstadoCarregando forma="lista" linhas={2} rotulo="Carregando a agenda de hoje" />
        </Painel>

        <Painel titulo="Vazio">
          <EstadoVazio
            nivel={3}
            titulo="Nenhum paciente encontrado para “Joaquim”"
            explicacao="A busca procura pelo nome, entre os pacientes que você acompanha. Confira a grafia ou limpe a busca para ver a lista inteira."
            acao={{ rotulo: 'Limpar a busca', aoAcionar: () => undefined }}
          />
        </Painel>

        <Painel titulo="Erro">
          <EstadoErro
            nivel={3}
            erro={new ErroServico('INDISPONIVEL', 'Falha provocada pela vitrine.')}
            oQue="a lista de pacientes"
            aoTentarDeNovo={() => undefined}
          />
        </Painel>

        <Painel titulo="Preenchido — ao vivo, pelos serviços">
          <div className="flex flex-wrap gap-2">
            <Botao variante="secundaria" onClick={() => recarregar()}>Recarregar</Botao>
            <Botao variante="secundaria" onClick={() => recarregar(true)}>
              Recarregar com falha
            </Botao>
          </div>

          {estado.tipo === 'carregando' && (
            <EstadoCarregando forma="tabela" colunas={4} linhas={2} rotulo="Carregando a lista de pacientes" />
          )}
          {estado.tipo === 'erro' && (
            <EstadoErro nivel={3} erro={estado.erro} oQue="a lista de pacientes" aoTentarDeNovo={() => recarregar()} />
          )}
          {estado.tipo === 'pronto' && (
            <>
              <Tabela
                legenda="Todos os pacientes da clínica"
                colunas={colunas}
                linhas={estado.dados.itens}
                chave={(p) => p.id}
                atualizando={estado.atualizando}
                nota="Dados fictícios de demonstração."
              />
              <Paginacao
                pagina={estado.dados.pagina}
                porPagina={estado.dados.porPagina}
                total={estado.dados.total}
                aoMudar={setPagina}
                rotulo="Páginas da lista de pacientes"
                nomeItens={{ singular: 'paciente', plural: 'pacientes' }}
              />
            </>
          )}
        </Painel>
      </div>
    </Tela>
  )
}
