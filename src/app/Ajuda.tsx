import { Tela } from './LayoutApp'
import { Cartao } from '../ui/Cartao'
import { Titulo } from '../ui/Titulo'
import { BarraPreferencias } from '../componentes/BarraPreferencias'

const principios = [
  { n: 1, nome: 'Perceptível', texto: 'A informação é apresentada de formas que as pessoas possam perceber. Todo ícone tem rótulo textual, todo gráfico tem alternativa em tabela e nenhum estado depende apenas de cor.' },
  { n: 2, nome: 'Operável', texto: 'Toda função é alcançável pelo teclado, o foco é sempre visível e os alvos de toque têm 44 pixels — o dobro do mínimo exigido.' },
  { n: 3, nome: 'Compreensível', texto: 'Linguagem cotidiana nas áreas da família e da escola, trilha de navegação em todas as telas e mensagens de erro que dizem o que fazer.' },
  { n: 4, nome: 'Robusto', texto: 'Marcação semântica padrão, sem dependência de recurso proprietário. Funciona em leitores de tela, em navegadores antigos e em telas pequenas.' },
]

const heuristicas = [
  ['Visibilidade do status', 'O estado de conexão e os registros pendentes ficam sempre visíveis.'],
  ['Consistência e padronização', 'As três áreas compartilham a mesma estrutura; muda a densidade e o vocabulário, nunca o esqueleto.'],
  ['Prevenção de erros', 'Opções fechadas em vez de digitação livre; a lista do que a escola nunca verá aparece ao lado da autorização.'],
  ['Controle e liberdade', 'A família encerra o acesso da escola quando quiser, com efeito imediato.'],
  ['Reconhecer em vez de lembrar', 'O cartão de estratégias mostra as orientações por extenso, sem exigir memória do combinado.'],
  ['Design minimalista', 'Cada tela responde a uma pergunta só.'],
  ['Recuperação de erros', 'A validação nomeia exatamente o que falta e devolve o foco ao campo certo.'],
]

export function Ajuda() {
  return (
    <Tela area="neutro" caminho={['Início', 'Acessibilidade e ajuda']}>
      <Titulo sub="O que foi implementado nesta interface e como ajustá-la ao seu jeito de usar">
        Acessibilidade
      </Titulo>

      <Cartao>
        <h2 className="text-lg font-bold">Ajuste a interface agora</h2>
        <p className="mt-1 mb-4 text-sm text-tinta2">
          As três preferências abaixo valem para todas as telas e também estão no topo da página.
        </p>
        <div className="rounded-lg bg-cromo p-3">
          <BarraPreferencias />
        </div>
      </Cartao>

      <Cartao>
        <h2 className="text-lg font-bold">Navegação por teclado</h2>
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
          {[
            ['Tab', 'avança para o próximo elemento'],
            ['Shift + Tab', 'volta para o anterior'],
            ['Enter ou Espaço', 'aciona o elemento em foco'],
            ['Tab na abertura', 'revela “Pular para o conteúdo”'],
          ].map(([tecla, acao]) => (
            <div key={tecla} className="flex gap-3">
              <dt className="min-w-32 font-bold tabular-nums">{tecla}</dt>
              <dd className="text-tinta2">{acao}</dd>
            </div>
          ))}
        </dl>
      </Cartao>

      <h2 className="mt-2 text-lg font-bold">
        Os quatro princípios da <abbr title="Web Content Accessibility Guidelines">WCAG</abbr> 2.2
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {principios.map((p) => (
          <Cartao key={p.n}>
            <div className="flex items-center gap-2.5">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-cli-ink text-sm font-bold text-white" aria-hidden="true">
                {p.n}
              </span>
              <h3 className="font-bold">{p.nome}</h3>
            </div>
            <p className="mt-2 text-sm text-tinta2">{p.texto}</p>
          </Cartao>
        ))}
      </div>

      <Cartao>
        <h2 className="text-lg font-bold">Heurísticas de usabilidade aplicadas</h2>
        <ul className="mt-3 flex flex-col gap-2.5">
          {heuristicas.map(([nome, texto]) => (
            <li key={nome} className="text-sm">
              <b>{nome}.</b> <span className="text-tinta2">{texto}</span>
            </li>
          ))}
        </ul>
      </Cartao>

      <Cartao>
        <h2 className="text-lg font-bold">Conformidade declarada</h2>
        <p className="mt-2 text-sm text-tinta2">
          Esta interface implementa 21 critérios da WCAG 2.2 em nível AA e 30 recomendações do
          e-MAG 3.1, o Modelo de Acessibilidade em Governo Eletrônico. Aplica ainda as recomendações
          de acessibilidade cognitiva do grupo COGA, do W3C, e o guia GAIA, voltado a aspectos do
          autismo. A tipografia é a Atkinson Hyperlegible, desenvolvida pelo Braille Institute of
          America para melhorar a legibilidade de pessoas com baixa visão.
        </p>
        <p className="mt-3 text-sm text-tinta2">
          Encontrou uma barreira de acesso? Registre no repositório do projeto. Tratamos relatos de
          acessibilidade com a mesma prioridade de um defeito funcional.
        </p>
      </Cartao>
    </Tela>
  )
}
