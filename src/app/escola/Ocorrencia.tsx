import { useRef, useState } from 'react'
import { Tela } from '../LayoutApp'
import { Aviso } from '../../ui/Aviso'
import { Botao } from '../../ui/Botao'
import { Titulo } from '../../ui/Titulo'

const tipos = ['Saiu da sala', 'Tapou os ouvidos', 'Recusou a tarefa', 'Chorou', 'Agrediu-se', 'Outro']
const intensidades = ['1', '2', '3', '4', '5']
const momentos = ['Entrada', 'Atividade em grupo', 'Recreio', 'Troca de atividade', 'Saída']

function Grupo({ id, titulo, ajuda, opcoes, valor, aoEscolher, refPrimeiro }: {
  id: string; titulo: string; ajuda?: string; opcoes: string[]
  valor: string | null; aoEscolher: (v: string) => void
  refPrimeiro?: React.Ref<HTMLButtonElement>
}) {
  return (
    <fieldset className="rounded-xl border border-linha p-4">
      <legend className="px-1.5 font-bold">{titulo}</legend>
      {ajuda && <p className="mb-2.5 mt-2 text-sm text-tinta2">{ajuda}</p>}
      <div className="mt-2.5 flex flex-wrap gap-2.5" id={id}>
        {opcoes.map((o, i) => (
          <button
            key={o}
            ref={i === 0 ? refPrimeiro : undefined}
            onClick={() => aoEscolher(o)}
            aria-pressed={valor === o}
            className={`min-h-11 cursor-pointer rounded-full border-2 px-4 py-2.5 ${
              valor === o ? 'border-esc bg-esc-sup font-bold text-esc-ink' : 'border-linha bg-sup text-tinta'
            }`}
          >
            {valor === o && <span aria-hidden="true">✓ </span>}
            {o}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

export function Ocorrencia() {
  const [tipo, setTipo] = useState<string | null>(null)
  const [intensidade, setIntensidade] = useState<string | null>(null)
  const [momento, setMomento] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [enviado, setEnviado] = useState(false)
  const primeiro = useRef<HTMLButtonElement>(null)

  const registrar = () => {
    const falta: string[] = []
    if (!tipo) falta.push('o que aconteceu')
    if (!intensidade) falta.push('a intensidade')
    if (!momento) falta.push('o momento')

    if (falta.length) {
      const lista = falta.length > 1
        ? `${falta.slice(0, -1).join(', ')} e ${falta[falta.length - 1]}`
        : falta[0]
      setErro(`Falta escolher ${lista}. Toque em uma opção de cada bloco acima.`)
      setEnviado(false)
      primeiro.current?.focus()
      return
    }
    setErro(null)
    setEnviado(true)
  }

  return (
    <Tela
      area="esc"
      nome="Registrar ocorrência"
      papel="Miguel S. · 2º ano B"
      caminho={['Início', 'Miguel S.', 'Registrar ocorrência']}
      estreito
    >
      <Titulo sub="Descreva o que aconteceu, não o que significa. A interpretação clínica é da terapeuta.">
        O que você observou?
      </Titulo>

      <Grupo id="g-tipo" titulo="1. O que aconteceu" opcoes={tipos} valor={tipo}
        aoEscolher={(v) => { setTipo(v); setErro(null) }} refPrimeiro={primeiro} />

      <Grupo id="g-int" titulo="2. Intensidade"
        ajuda="1 = quase não atrapalhou · 5 = precisou interromper a aula"
        opcoes={intensidades} valor={intensidade}
        aoEscolher={(v) => { setIntensidade(v); setErro(null) }} />

      <Grupo id="g-mom" titulo="3. Em que momento" opcoes={momentos} valor={momento}
        aoEscolher={(v) => { setMomento(v); setErro(null) }} />

      {/* Erro descrito em texto, nomeando o que falta — WCAG 3.3.1 / e-MAG 6.6. */}
      <div aria-live="assertive">
        {erro && <p className="font-bold text-cr" role="alert">{erro}</p>}
      </div>

      <Botao area="esc" className="w-full" onClick={registrar}>
        Registrar e avisar a terapeuta
      </Botao>

      <div aria-live="polite">
        {enviado && (
          <Aviso tom="ok" titulo="Ocorrência registrada">
            A terapeuta responsável foi avisada. Você não precisa fazer mais nada. Se precisar
            corrigir alguma coisa, dá tempo nos próximos 30 minutos.
          </Aviso>
        )}
      </div>

      <p className="text-sm text-tinta2">
        Leva cerca de 20 segundos: três toques e enviar. Feito para caber no intervalo entre uma
        atividade e outra.
      </p>
    </Tela>
  )
}
