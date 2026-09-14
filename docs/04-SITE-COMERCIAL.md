# 04 · Site comercial

Cinco páginas públicas. O texto abaixo é **final** — copie como está. Se precisar
mudar, mude com intenção, não por preferência de estilo.

---

## Princípio: honestidade vende melhor aqui

O sistema ainda não tem back-end, não tem piloto e não tem cliente. Uma clínica que
descobrir isso depois de acreditar no contrário não volta.

Além disso, o dado em jogo é dado de saúde de criança. Prometer o que não existe
nesse contexto não é otimismo comercial — é irresponsabilidade.

Por isso: **sem preço, sem "assine agora", sem depoimento inventado, sem logotipo
de cliente que não existe.** O que o site oferece é a demonstração real e a
possibilidade de acompanhar o desenvolvimento.

---

## Estrutura

| Rota | Página | Objetivo |
|---|---|---|
| `/` | Início | Fazer o visitante entender o problema em 30 segundos |
| `/solucao` | Como funciona | Mostrar os três contextos |
| `/acessibilidade` | Acessibilidade | Transformar o diferencial técnico em argumento |
| `/projeto` | O projeto | Quem somos e em que estágio estamos |
| `/contato` | Lista de espera | Captar contato |

Cabeçalho fixo com navegação e dois botões: **Ver a demonstração** (leva a
`/app/entrar`) e **Entrar na lista de espera**.

---

# `/` Início

## Abertura

**A terapia continua depois que a sessão acaba**

O SINCTEA liga clínica, família e escola em torno do mesmo plano terapêutico — com
a família controlando cada passagem de informação.

`[ Ver a demonstração ]` `[ Entrar na lista de espera ]`

## O problema em três números

| | |
|---|---|
| **2,4 milhões** | de pessoas com TEA no Brasil, segundo o Censo 2022 |
| **56,5%** | recebem no máximo duas horas de terapia por semana |
| **39,9%** | dos que frequentam escola não contam com apoio pedagógico |

Fontes: IBGE, Censo Demográfico 2022 · Instituto Autismos, Mapa Autismo Brasil.

## A consequência

Se o atendimento semanal se limita a poucas horas, a maior parte do tempo de
vigília transcorre fora do ambiente terapêutico — sobretudo em casa e na escola.

O que se trabalha na clínica não se generaliza sozinho para esses outros contextos.
Stokes e Baer deram nome a essa expectativa em 1977: *train and hope*. Treinar e
torcer.

O professor não sabe o que a clínica combinou. A família recebe orientação verbal
na porta e esquece metade no caminho. A clínica descobre semanas depois que algo
mudou na escola. Ninguém está errado — falta um canal.

## O que o SINCTEA faz

**Não é um sistema de gestão de clínica.** Existem bons, e eles resolvem agenda,
prontuário e faturamento.

O SINCTEA resolve outro problema: faz a informação terapêutica acompanhar a pessoa
pelos ambientes em que ela realmente vive.

- **Na clínica** — plano terapêutico, registro de sessão em um toque por tentativa,
  evolução por objetivo. Funciona sem internet e sincroniza depois.
- **Em casa** — a família acompanha em linguagem cotidiana e recebe atividades
  curtas com vídeo. Registra como foi em três opções.
- **Na escola** — o professor consulta o que fazer, o que evitar e os sinais de
  atenção. Registra ocorrências em poucos toques. Nunca acessa evolução nem plano.

`[ Ver como funciona ]`

## O que nos torna diferentes

**A família controla o acesso.** Não a clínica, não a escola.

Quem autoriza o acesso da escola é o responsável. A autorização tem escopo e prazo.
O professor entra por convite de uso único que expira em 72 horas. A revogação vale
no mesmo instante.

Cada leitura de dado sensível é verificada antes de acontecer e registrada depois —
inclusive quando é negada.

Isso não é uma tela de configuração. É a estrutura do banco de dados: sem
consentimento não existe vínculo escolar, e sem vínculo não existe registro.

## Acessibilidade não é item de lista

O sistema atende pessoas com Transtorno do Espectro Autista, e boa parte de quem
opera são mães que chegam ao fim do dia exaustas e professores com trinta alunos
sob responsabilidade.

Tipografia desenhada para baixa visão. Paleta verificada para daltonismo por
cálculo, não por impressão. Navegação inteira por teclado. Linguagem literal, sem
metáfora. Preferências de texto, contraste e movimento controladas por quem usa.

`[ Ver o compromisso de acessibilidade ]`

## Fecho

**Quer acompanhar?**

O SINCTEA está em desenvolvimento como Trabalho de Conclusão de Curso no Centro
Universitário FAMETRO. Buscamos clínicas dispostas a conversar sobre a rotina real
de acompanhamento e, mais adiante, a testar o sistema.

`[ Entrar na lista de espera ]`

---

# `/solucao` Como funciona

Abertura: **Um plano, três contextos**

> O mesmo objetivo terapêutico aparece de três formas diferentes — para o
> profissional, para a família e para a escola. Quem escreve as três é o terapeuta.

## O exemplo que explica tudo

| Quem lê | O que vê |
|---|---|
| Terapeuta | Emitir mando por item preferido em 8 de 10 tentativas, com ajuda gestual desvanecida |
| Família e escola | Pedir o que quer, apontando ou falando, sem precisar que o adulto ajude |

É o mesmo objetivo. A segunda redação não é tradução automática: é escrita pelo
profissional, que responde pelo conteúdo.

Depois: um bloco por contexto, com o que cada perfil faz e uma imagem da tela real.
Ao final de cada bloco, um link que abre aquela tela na demonstração.

Fecho: o fluxo completo da ponte clínica–escola em cinco passos, com o diagrama de
sequência simplificado.

---

# `/acessibilidade` Compromisso de acessibilidade

**Feito para ser usado por quem tem pressa, cansaço ou dificuldade**

| O que fizemos | Por quê |
|---|---|
| Tipografia Atkinson Hyperlegible | Desenhada pelo Braille Institute para baixa visão: diferencia "I", "l" e "1" por forma |
| Paleta validada por cálculo | Separação verificada para deuteranopia e tritanopia. A primeira escolha reprovou e foi trocada |
| Nada só por cor | Todo estado tem símbolo e texto. Funciona impresso em preto e branco |
| Alvos de 44 pixels | O dobro do mínimo da norma. Terapeuta e professor operam com atenção dividida |
| Navegação por teclado | Toda função, sem exceção |
| Linguagem literal | Sem metáfora nem sentido figurado, conforme o guia GAIA |

**Normas seguidas:** WCAG 2.2 nível AA · e-MAG 3.1 · recomendações COGA do W3C ·
guia GAIA (Britto e Pizzolato, 2018).

Fecho: "Encontrou uma barreira de acesso? Escreva para nós. Tratamos relato de
acessibilidade com a mesma prioridade de um defeito funcional."

---

# `/projeto` O projeto

**Um Trabalho de Conclusão de Curso que quer virar produto**

Origem, fundamentação e equipe: Eduardo da Cruz Monteiro e Lucas Magalhães Pinto,
Sistemas de Informação, Centro Universitário FAMETRO, orientação da Profa. Luana
Leal.

## Em que estágio estamos — leia antes de esperar algo

| Pronto | Em desenvolvimento | Ainda não existe |
|---|---|---|
| Modelagem completa do sistema | Interface das três áreas | Banco de dados em produção |
| Documentação de acessibilidade | Camada de dados | Piloto com clínica real |
| Interface navegável | | Aplicativo publicado nas lojas |

A demonstração funciona com **dados fictícios**. Nada do que você digitar nela é
gravado.

Alinhamento aos Objetivos de Desenvolvimento Sustentável: metas 3.4 e 3.8 do ODS 3
e meta 8.5 do ODS 8.

---

# `/contato` Lista de espera

**Quer ser avisado quando abrirmos o piloto?**

Estamos conversando com clínicas sobre a rotina real de acompanhamento. Se você
trabalha com TEA — como profissional, gestor, familiar ou educador — queremos
ouvir.

**Campos:** nome · e-mail · organização (opcional) · papel (seleção: profissional
de saúde, gestão de clínica, familiar, educador, outro) · "O que é mais difícil na
sua rotina hoje?" (área de texto, opcional).

Botão: **Quero acompanhar**

Abaixo do formulário: "Usamos seu contato só para avisar sobre o SINCTEA. Não
compartilhamos com ninguém e você pode pedir a remoção quando quiser."

**Nota para a implementação:** sem back-end, o formulário não envia de verdade.
Não finja que enviou. Mostre a confirmação e, junto, uma linha honesta: "Enquanto o
serviço de cadastro não entra no ar, escreva para *[e-mail da equipe]* que
respondemos." Interface que mente sobre ter salvo é pior que interface que não
salva.

---

## Notas de implementação

- O site é **estático e rápido**. Sem carrossel, sem animação de rolagem, sem
  contador que anima. A mesma regra de movimento do sistema vale aqui.
- Imagens das telas: capturas reais da aplicação, não ilustração genérica.
- Cada página tem um `h1`, hierarquia sem salto e título de documento próprio.
- A linha de leitura fica em no máximo 65 caracteres.
- O cabeçalho **não** é fixo em telas menores que 640px — rouba altura demais.
- Cores: use o azul-petróleo da clínica como cor de marca do site. Âmbar e
  terracota entram apenas quando o assunto for aquele contexto específico.
