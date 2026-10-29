import { useEffect, useId, useState, type KeyboardEvent } from 'react'
import { Botao } from '../../ui/Botao'
import { Campo } from '../../ui/Campo'
import { servicos, type PacienteResumo } from '../../servicos'
import { proximaSugestao, situacaoDaBusca, SUGESTOES_DA_BUSCA, textoParaBuscar } from './sugestoesDePaciente'

/**
 * O filtro "Paciente" da tela 13 (item 17b): busca pelo nome, como na tela 4,
 * com sugestoes a partir de duas letras e ate 20 delas. A lista nao para nos
 * 100 primeiros pacientes. Segue o padrao de combobox do ARIA: as setas andam
 * pelas sugestoes, Enter escolhe, Esc fecha.
 *
 * Escolhido, o paciente vai para o endereco; o nome que aparece aqui vem de
 * quem chama (a leitura da ficha, a mesma da trilha de navegacao).
 */
export function BuscaDePaciente({ pacienteId, nome, aoEscolher, classeDoCampo }: {
  pacienteId: string
  nome: string | null
  aoEscolher: (pacienteId: string | null) => void
  classeDoCampo: string
}) {
  const id = useId()
  const [texto, setTexto] = useState('')
  const [sugestoes, setSugestoes] = useState<PacienteResumo[] | null>(null)
  const [marcada, setMarcada] = useState(-1)
  const [aberta, setAberta] = useState(false)

  useEffect(() => {
    const busca = textoParaBuscar(texto)
    setMarcada(-1)
    if (busca === null) { setSugestoes(null); return }
    let ativo = true
    setSugestoes(null)
    // Uma busca por pausa na digitacao, e nao por tecla: cada uma entra na trilha.
    const espera = setTimeout(() => {
      servicos.pacientes.listar({ busca, porPagina: SUGESTOES_DA_BUSCA })
        .then((p) => { if (ativo) setSugestoes(p.itens) })
        .catch(() => { if (ativo) setSugestoes([]) })
    }, 300)
    return () => { ativo = false; clearTimeout(espera) }
  }, [texto])

  const escolher = (p: PacienteResumo) => {
    setTexto('')
    setAberta(false)
    aoEscolher(p.id)
  }

  const teclar = (e: KeyboardEvent<HTMLInputElement>) => {
    const total = sugestoes?.length ?? 0
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setAberta(true)
      setMarcada((atual) => proximaSugestao(atual, e.key as 'ArrowDown' | 'ArrowUp', total))
    } else if (e.key === 'Enter' && aberta && sugestoes && marcada >= 0) {
      e.preventDefault()
      escolher(sugestoes[marcada])
    } else if (e.key === 'Escape') {
      setAberta(false)
      setMarcada(-1)
    }
  }

  if (pacienteId) {
    return (
      <Campo id={`${id}-escolhido`} rotulo="Paciente">
        <div className="flex min-h-11 flex-wrap items-center gap-2">
          <output id={`${id}-escolhido`} className="font-bold">{nome ?? 'Paciente escolhido'}</output>
          <Botao area="cli" variante="secundaria" onClick={() => aoEscolher(null)}>
            Trocar o paciente
          </Botao>
        </div>
      </Campo>
    )
  }

  const listaVisivel = aberta && sugestoes !== null && sugestoes.length > 0
  return (
    // A orientacao fica abaixo do campo, na linha da situacao: acima, desalinharia a linha dos filtros.
    <Campo id={`${id}-busca`} rotulo="Paciente">
      <div className="relative">
        <input
          id={`${id}-busca`}
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={listaVisivel}
          aria-controls={`${id}-lista`}
          aria-activedescendant={listaVisivel && marcada >= 0 ? `${id}-opcao-${marcada}` : undefined}
          aria-describedby={`${id}-situacao`}
          autoComplete="off"
          className={classeDoCampo}
          value={texto}
          onChange={(e) => { setTexto(e.target.value); setAberta(true) }}
          onKeyDown={teclar}
          onFocus={() => setAberta(true)}
          // O toque numa sugestao chega antes de o campo perder o foco.
          onBlur={() => setTimeout(() => setAberta(false), 150)}
        />
        <ul
          id={`${id}-lista`}
          role="listbox"
          aria-label="Pacientes encontrados"
          hidden={!listaVisivel}
          className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border-2 border-linha bg-sup shadow-lg"
        >
          {(sugestoes ?? []).map((p, i) => (
            <li
              key={p.id}
              id={`${id}-opcao-${i}`}
              role="option"
              aria-selected={i === marcada}
              className={`flex min-h-11 cursor-pointer flex-col justify-center px-3 py-2 ${i === marcada ? 'bg-cli-sup' : 'hover:bg-sup2'}`}
              onMouseDown={(e) => { e.preventDefault(); escolher(p) }}
            >
              <span className="font-bold">{p.nome}</span>
              <span className="text-sm text-tinta2">{p.idade} anos · {p.profissionalResponsavel.nome}</span>
            </li>
          ))}
        </ul>
      </div>
      <p id={`${id}-situacao`} role="status" aria-live="polite" className="text-sm text-tinta2">
        {situacaoDaBusca(texto, sugestoes === null ? null : sugestoes.length)}
      </p>
    </Campo>
  )
}
