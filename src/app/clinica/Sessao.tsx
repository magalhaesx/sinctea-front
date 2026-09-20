import { useState } from 'react'
import { Tela } from '../LayoutApp'
import { Botao, Cartao, Etiqueta, Titulo } from '../../componentes/ui'
import type { Resultado } from '../../tipos/dominio'

const respostas: { valor: Resultado; rotulo: string }[] = [
  { valor: 'INDEPENDENTE', rotulo: 'Independente' },
  { valor: 'AJUDA_GESTUAL', rotulo: 'Com ajuda gestual' },
  { valor: 'AJUDA_FISICA', rotulo: 'Com ajuda física' },
  { valor: 'SEM_RESPOSTA', rotulo: 'Sem resposta' },
]

export function RegistroSessao() {
  const [registros, setRegistros] = useState<Resultado[]>([])
  const [ultima, setUltima] = useState<Resultado | null>(null)

  const registrar = (r: Resultado) => {
    setRegistros((rs) => [...rs, r])
    setUltima(r)
  }
  const desfazer = () => {
    setRegistros((rs) => rs.slice(0, -1))
    setUltima(null)
  }

  const total = registros.length
  const independentes = registros.filter((r) => r === 'INDEPENDENTE').length
  const aproveitamento = total ? Math.round((independentes / total) * 100) : 0

  return (
    <Tela
      area="cli"
      nome="Sessão em andamento · Miguel Santana"
      papel="Iniciada às 14h02 · sala 3"
      caminho={['Início', 'Miguel Santana', 'Registro de sessão']}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Titulo sub={`Emitir mando por item preferido · tentativa ${Math.min(total + 1, 10)} de 10`}>
          Comunicação funcional
        </Titulo>
        <Etiqueta tom="at" simbolo="✈">Sem conexão — salvando no aparelho</Etiqueta>
      </div>

      <Cartao>
        <h2 id="h-resp" className="text-base font-bold">Como foi esta tentativa?</h2>
        <p className="mb-3 text-sm text-tinta2">Um toque registra e avança para a próxima.</p>
        <div className="grid gap-2.5 sm:grid-cols-2" role="group" aria-labelledby="h-resp">
          {respostas.map((r) => (
            <button
              key={r.valor}
              onClick={() => registrar(r.valor)}
              className={`min-h-14 rounded-lg border-2 px-4 py-4 text-left font-bold cursor-pointer ${
                ultima === r.valor ? 'border-cli bg-cli-sup' : 'border-linha bg-sup hover:border-cli'
              }`}
            >
              {ultima === r.valor && <span aria-hidden="true">✓ </span>}
              {r.rotulo}
            </button>
          ))}
        </div>

        {/* Correcao de erro: acao sem retorno precisa de desfazer (heuristica H3). */}
        <div className="mt-3 flex items-center gap-3" aria-live="polite">
          {total > 0 && (
            <>
              <span className="text-sm text-tinta2">
                {total} {total === 1 ? 'tentativa registrada' : 'tentativas registradas'}
              </span>
              <Botao area="cli" variante="secundaria" onClick={desfazer}>
                Desfazer o último registro
              </Botao>
            </>
          )}
        </div>
      </Cartao>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ['Acertos independentes', `${independentes} / ${total || 0}`],
          ['Aproveitamento da sessão', `${aproveitamento}%`],
          ['Tempo decorrido', '18 min'],
        ].map(([r, v]) => (
          <Cartao key={r}>
            <p className="text-sm text-tinta2">{r}</p>
            <p className="text-2xl font-bold tabular-nums">{v}</p>
          </Cartao>
        ))}
      </div>

      <Cartao>
        <h2 className="text-base font-bold">Ocorrência comportamental</h2>
        <p className="mb-3 text-sm text-tinta2">
          Registre apenas se algo relevante aconteceu durante a sessão.
        </p>
        <Botao area="cli" variante="secundaria">
          + Registrar ocorrência (antecedente, comportamento, consequência)
        </Botao>
      </Cartao>

      <div className="flex flex-wrap items-center gap-3 border-t border-linha pt-3">
        <Botao area="cli">Encerrar sessão</Botao>
        <Botao area="cli" variante="secundaria">Pausar</Botao>
        <span className="text-sm text-tinta2">
          Tudo é salvo no aparelho e sincronizado quando a rede voltar.
        </span>
      </div>
    </Tela>
  )
}
