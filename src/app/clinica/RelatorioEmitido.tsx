import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Tela } from '../LayoutApp'
import { Aviso } from '../../ui/Aviso'
import { Botao } from '../../ui/Botao'
import { Titulo } from '../../ui/Titulo'
import { EstadoCarregando } from '../../ui/EstadoCarregando'
import { EstadoErro } from '../../ui/EstadoErro'
import { FolhaRelatorio } from '../../componentes/FolhaRelatorio'
import { resumoSha256 } from '../../dominio/hash'
import { ErroServico, servicos, type RelatorioEvolucao } from '../../servicos'

/**
 * Tela 10b · Relatorio emitido
 * /app/clinica/pacientes/:id/relatorio/:relatorioId · UC09
 *
 * Mostra o documento como ele saiu, e confere: ao abrir, recalcula o hash do
 * conteudo guardado e compara com o que foi gravado na emissao. E a prova
 * funcionando — nao um selo desenhado na tela.
 *
 * O PDF e do navegador, por window.print(): nao ha back-end para guardar
 * arquivo, e uma biblioteca de PDF so acrescentaria peso para refazer o que a
 * impressao ja faz.
 */

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; erro: unknown }
  | { tipo: 'pronto'; relatorio: RelatorioEvolucao }

type Conferencia = 'conferindo' | 'confere' | 'difere' | 'indisponivel'

const dataEHora = (iso: string) => {
  const d = new Date(iso)
  return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
}

export function RelatorioEmitido() {
  const { id = '', relatorioId = '' } = useParams()
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' })
  const [tentativa, setTentativa] = useState(0)
  const [conferencia, setConferencia] = useState<Conferencia>('conferindo')

  useEffect(() => {
    let ativo = true
    setEstado({ tipo: 'carregando' })
    setConferencia('conferindo')
    servicos.relatorios.obter(relatorioId)
      .then(async (relatorio) => {
        if (!ativo) return
        setEstado({ tipo: 'pronto', relatorio })
        try {
          const recalculado = await resumoSha256(relatorio.conteudoEmitido)
          if (ativo) setConferencia(recalculado === relatorio.hashConteudo ? 'confere' : 'difere')
        } catch {
          // Sem crypto.subtle (contexto inseguro), nao da para conferir. Dizer
          // isso e melhor do que mostrar um "conferido" que nao aconteceu.
          if (ativo) setConferencia('indisponivel')
        }
      })
      .catch((erro) => { if (ativo) setEstado({ tipo: 'erro', erro }) })
    return () => { ativo = false }
  }, [relatorioId, tentativa])

  const negado = estado.tipo === 'erro' && estado.erro instanceof ErroServico
    && estado.erro.codigo === 'ACESSO_NEGADO'

  return (
    <Tela area="cli" caminho={['Área clínica', 'Pacientes', 'Relatório emitido']}>
      <div className="nao-imprimir flex flex-col gap-4">
        <Titulo sub="Documento emitido. Não se regenera: é esta cópia que a família ou o outro profissional recebeu">
          Relatório de evolução
        </Titulo>

        {estado.tipo === 'pronto' && (
          <div className="flex flex-wrap gap-2">
            <Botao area="cli" onClick={() => window.print()}>Imprimir ou salvar em PDF</Botao>
            <Link
              to={`/app/clinica/pacientes/${id}/relatorio`}
              className="min-h-11 items-center self-center font-bold text-cli-ink underline"
            >
              Voltar para emitir outro
            </Link>
          </div>
        )}

        {conferencia === 'difere' && estado.tipo === 'pronto' && (
          <Aviso tom="cr" titulo="O conteúdo não confere com a emissão">
            O resumo calculado agora é diferente do que foi gravado quando o relatório saiu. Não
            use esta cópia como documento: procure a coordenação da clínica.
          </Aviso>
        )}
      </div>

      {estado.tipo === 'carregando' && (
        <EstadoCarregando forma="cartoes" quantidade={1} rotulo="Carregando o relatório emitido" />
      )}

      {estado.tipo === 'erro' && (
        <EstadoErro
          erro={estado.erro}
          oQue="este relatório"
          titulo={negado ? 'Este relatório não é do seu alcance' : undefined}
          texto={negado
            ? 'O relatório é de um paciente que você não acompanha. Se precisar consultá-lo, fale com a coordenação da clínica.'
            : undefined}
          aoTentarDeNovo={negado ? undefined : () => setTentativa((t) => t + 1)}
        />
      )}

      {estado.tipo === 'pronto' && (
        <FolhaRelatorio
          conteudo={estado.relatorio.conteudoEmitido}
          rodape={
            <footer className="mt-6 border-t border-linha pt-4 text-sm text-tinta2">
              <p>
                Emitido por <b className="text-tinta">{estado.relatorio.autorNome}</b>
                {' · '}{estado.relatorio.autorRegistro}
                {' · '}{dataEHora(estado.relatorio.emitidoEm)}
              </p>
              <p className="mt-1 break-all">
                Resumo do conteúdo: <span className="font-mono">{estado.relatorio.hashConteudo}</span>
              </p>
              <p className="mt-1">
                {conferencia === 'confere' && (
                  <b className="text-ok">
                    Conteúdo conferido: igual ao emitido em {dataEHora(estado.relatorio.emitidoEm)}.
                  </b>
                )}
                {conferencia === 'conferindo' && 'Conferindo o conteúdo…'}
                {conferencia === 'difere' && (
                  <b className="text-cr">
                    Conteúdo diferente do emitido em {dataEHora(estado.relatorio.emitidoEm)}.
                  </b>
                )}
                {conferencia === 'indisponivel' && 'Não foi possível conferir o resumo neste navegador.'}
              </p>
            </footer>
          }
        />
      )}
    </Tela>
  )
}
