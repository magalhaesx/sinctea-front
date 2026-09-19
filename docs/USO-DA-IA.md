# Utilização da IA como agente

Documento referente ao item 1 da orientação: *Utilização de IA como Agente*.

## A ordem importou mais do que a ferramenta

A orientação diz que a IA "não substitui o planejamento humano" e que é "ferramenta de
apoio à análise, criatividade, organização e construção da solução". Na prática, isso se
traduziu em uma regra de trabalho: **a IA só entrou depois que a decisão humana já tinha
sido tomada.**

A sequência foi esta:

| # | Etapa | Quem decidiu | Papel da IA |
|---|---|---|---|
| 1 | Escolha do tema e do recorte | Equipe | Pesquisa de sistemas existentes e de lacunas de mercado |
| 2 | Problema de pesquisa e objetivos | Equipe e orientadora | Nenhum |
| 3 | Levantamento de dados e referências | Equipe | Busca e verificação de fontes primárias (IBGE, Instituto Autismos, legislação) |
| 4 | Requisitos e regras de negócio | Equipe | Organização, identificação de contradições |
| 5 | Modelagem UML | Equipe | Desenho dos diagramas a partir das regras definidas |
| 6 | Documento de acessibilidade e design | Equipe | Verificação normativa (WCAG 2.2, e-MAG 3.1) e redação |
| 7 | Interface e front-end | Equipe | Construção a partir do documento anterior |

O ponto que consideramos decisivo: **a IA nunca definiu uma regra de negócio.** Quando a
interface precisou saber quem autoriza o acesso da escola, a resposta não veio da IA —
veio da seção 6.1.3 do pré-projeto, que a equipe escreveu.

## O que a IA fez bem

- **Encontrou contradições que passariam despercebidas.** Ao cruzar os diagramas com o
  texto do pré-projeto, apontou que o diagrama de casos de uso atribuía ao professor a
  autorização do próprio acesso — o inverso do que o texto define e do que a LGPD exige.
  Quatro atribuições de ator estavam trocadas.
- **Verificou norma em vez de afirmar de memória.** A versão vigente do e-MAG e a
  numeração exata de suas 45 recomendações foram consultadas na fonte, não assumidas.
- **Validou a paleta por cálculo.** As três cores de área foram testadas para
  deuteranopia e tritanopia. A primeira combinação escolhida por gosto **reprovou**, e
  foi substituída.

## Onde a IA errou, e como percebemos

- A primeira versão da interface tinha **overflow horizontal em telas de 400 px**, o que
  contrariava o critério 1.4.10 da WCAG que o próprio documento declarava atender. Só
  apareceu ao medir a página renderizada; não apareceu na leitura do código.
- A avaliação heurística inicial listava apenas heurísticas atendidas. Foi preciso pedir
  explicitamente as **violadas, com severidade**, para que os dois defeitos reais
  aparecessem.

Ambos os casos apontam para a mesma conclusão: a IA tende a confirmar o que se pede. O
valor do trabalho está em pedir a contradição, não a concordância.

## O diferencial não é o prompt

A orientação afirma que o diferencial do projeto está "na capacidade do grupo de
compreender o problema, tomar decisões de design, justificar suas escolhas e desenvolver
uma solução centrada nas necessidades reais dos usuários".

O que sustenta este front-end não é a qualidade da formulação do prompt: é o fato de
existirem, antes dele, um pré-projeto com fundamentação em dados primários, um conjunto
de regras de negócio escritas e três diagramas UML consistentes entre si. O prompt,
reproduzido em `PROMPT.md`, é longo justamente porque carrega esse material.

Trocada a ordem — prompt primeiro, projeto depois — o resultado seria uma interface
bonita e sem fundamento.

## A página de acessibilidade era inacessível

O documento de IHC afirma que o contraste foi "verificado por cálculo". Durante a
implementação a verificação foi refeita sobre o código real, e reprovou dois dos três
botões primários: texto branco sobre a cor de marca da clínica dá 3,09:1 e sobre a da
escola 3,19:1 — abaixo dos 4,5:1 exigidos pelo critério 1.4.3 da WCAG. O texto do
botão tem 15px em negrito e não se qualifica como texto grande.

A causa foi omissão de especificação. O design system definiu duas famílias de cor por
área, mas não disse qual delas preenche um botão. Sem a regra, a implementação escolheu
a de marca — validada para 3:1 contra a superfície, que é o piso de elemento não
textual, e nunca pensada para receber texto em cima.

O caso mais revelador estava na própria página que declara conformidade com a WCAG: os
círculos numerados dos quatro princípios usavam a mesma combinação reprovada.

Ficam duas lições registradas. Afirmar conformidade não é cumpri-la — o documento dizia
a coisa certa e o código fazia outra, e só a medição sobre o código real revelou a
diferença. E especificação incompleta produz defeito, não pergunta, a menos que se peça
a pergunta: foi a regra "pare e avise quando algo conflitar", escrita no CLAUDE.md, que
fez a contradição chegar à decisão humana em vez de ser resolvida em silêncio.
