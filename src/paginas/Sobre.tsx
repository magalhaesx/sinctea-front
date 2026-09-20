import { Tela } from '../componentes/Layout'
import { Cartao, Titulo } from '../componentes/ui'

const numeros = [
  { valor: '2,4 mi', texto: 'pessoas com TEA no Brasil, segundo o Censo 2022 (IBGE, 2025)' },
  { valor: '56,5%', texto: 'recebem no máximo duas horas de terapia por semana' },
  { valor: '39,9%', texto: 'dos que frequentam escola não contam com apoio pedagógico' },
]

export function Sobre() {
  return (
    <Tela area="neutro" caminho={['Início', 'A solução']}>
      <Titulo sub="Sistema Integrado de Continuidade Terapêutica no TEA">
        O problema não está dentro da clínica
      </Titulo>

      <div className="grid gap-3 sm:grid-cols-3">
        {numeros.map((n) => (
          <Cartao key={n.valor}>
            <p className="text-2xl font-bold tabular-nums text-cli-ink">{n.valor}</p>
            <p className="mt-1 text-sm text-tinta2">{n.texto}</p>
          </Cartao>
        ))}
      </div>

      <Cartao>
        <h2 className="text-lg font-bold">A consequência</h2>
        <p className="mt-2 text-tinta2">
          Se o atendimento semanal se limita a poucas horas, a maior parte do tempo de vigília
          transcorre fora do ambiente terapêutico — sobretudo em casa e na escola. O que se aprende
          na clínica não se generaliza sozinho para esses outros contextos. Stokes e Baer chamaram
          essa expectativa de <i>train and hope</i>: treinar e torcer.
        </p>
        <p className="mt-3 text-tinta2">
          O SINCTEA existe para fechar essa lacuna. Não é um sistema de gestão de clínica: é um
          sistema que faz a informação terapêutica acompanhar a pessoa pelos ambientes em que ela
          realmente vive.
        </p>
      </Cartao>

      <h2 className="mt-2 text-lg font-bold">Como funciona nos três contextos</h2>
      <div className="grid gap-3 md:grid-cols-3">
        <Cartao className="border-l-4 border-l-cli">
          <h3 className="font-bold text-cli-ink">Na clínica</h3>
          <p className="mt-2 text-sm text-tinta2">
            O terapeuta mantém o Plano Terapêutico Individual e registra a sessão em um toque por
            tentativa. Funciona sem internet e sincroniza depois — o que importa no atendimento
            domiciliar e em instituições do interior.
          </p>
        </Cartao>
        <Cartao className="border-l-4 border-l-fam">
          <h3 className="font-bold text-fam-ink">Em casa</h3>
          <p className="mt-2 text-sm text-tinta2">
            A família acompanha a evolução em linguagem cotidiana e recebe atividades curtas com
            vídeo demonstrativo. Depois registra como foi, em três opções.
          </p>
        </Cartao>
        <Cartao className="border-l-4 border-l-esc">
          <h3 className="font-bold text-esc-ink">Na escola</h3>
          <p className="mt-2 text-sm text-tinta2">
            O professor consulta o que fazer, o que evitar e os sinais de atenção — sem
            terminologia clínica — e registra ocorrências em poucos toques. Nunca acessa evolução
            nem plano terapêutico.
          </p>
        </Cartao>
      </div>

      <Cartao className="border-l-4 border-l-at">
        <h2 className="text-lg font-bold">O que sustenta a ponte: consentimento</h2>
        <p className="mt-2 text-tinta2">
          Quem autoriza o acesso da escola é a família — nunca a escola. A autorização tem escopo e
          validade, o professor entra por convite de uso único, e a revogação produz efeito
          imediato. Cada leitura de dado sensível é verificada antes de acontecer e registrada
          depois, inclusive quando é negada.
        </p>
        <p className="mt-3 text-sm text-tinta2">
          Lei nº 13.709/2018 (LGPD), artigos 7º, 8º, 11 e 18 · Lei nº 12.764/2012 · Lei nº 13.146/2015
        </p>
      </Cartao>
    </Tela>
  )
}
