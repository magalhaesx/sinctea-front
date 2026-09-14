# 05 · Roteiro para o Claude Code

Como usar: abra o Claude Code na pasta do projeto e cole **um bloco por vez**, na
ordem. Cada etapa depende da anterior.

Não cole tudo de uma vez. Sessão longa demais perde precisão, e você perde a
chance de conferir antes de seguir.

---

## Antes da primeira etapa

```bash
cd caminho/para/sinctea-front
npm install
npm run dev          # confira que abre
claude               # inicia o Claude Code
```

O Claude Code lê `CLAUDE.md` sozinho ao iniciar. Os documentos em `docs/` ele lê
quando você mandar — por isso cada prompt abaixo diz qual ler.

---

## Etapa 1 · Camada de dados e sessão

> Leia `docs/01-ARQUITETURA.md`, seções 3, 4, 5 e 6.
>
> Crie a camada de serviços conforme especificada: `servicos/tipos.ts`,
> `servicos/contratos.ts`, `servicos/mock/`, `servicos/api/` (stubs) e
> `servicos/index.ts` escolhendo a implementação por variável de ambiente.
>
> Respeite as quatro regras da seção 4.4: latência simulada de 200 a 600 ms, modo
> de falha acionável por `VITE_MOCK_FALHA`, toda listagem paginada com `Pagina<T>`,
> e nenhum componente importando de `servicos/mock`.
>
> Crie os dados de demonstração com cinco pacientes, três profissionais e duas
> escolas — não um de cada. Todos fictícios.
>
> Crie `contexto/Sessao.tsx` e o componente `ExigePerfil`. Deixe comentado no
> código que o redirecionamento não é segurança, apenas navegação.
>
> Crie `dominio/regras.ts` com as funções puras de regra de negócio e testes
> unitários para elas.
>
> Não altere nenhuma tela existente nesta etapa.

**Confira antes de seguir:** `npm run build` passa · os testes de `dominio/regras`
passam · nada quebrou na interface atual.

---

## Etapa 2 · Componentes de estado

> Leia `docs/02-DESIGN-SYSTEM.md`, seção 4.
>
> Crie `ui/EstadoCarregando.tsx`, `ui/EstadoVazio.tsx`, `ui/EstadoErro.tsx`,
> `ui/Tabela.tsx` e `ui/Paginacao.tsx`.
>
> O carregando é esqueleto com a forma do conteúdo, nunca um giro no meio da tela.
> O vazio recebe título, explicação e ação. O erro explica em linguagem de gente e
> oferece tentar de novo.
>
> A tabela tem `caption`, `th` com `scope` e rolagem horizontal em recipiente
> próprio, sem empurrar a página.

**Confira:** monte uma página de teste com os quatro estados lado a lado e olhe.

---

## Etapa 3 · Login e conta

> Leia `docs/03-TELAS-SISTEMA.md`, telas 1 e 21, e `docs/01-ARQUITETURA.md`,
> seção 2.
>
> Reorganize as rotas: site comercial em `/` e sistema em `/app`, conforme o mapa.
> Mova as páginas atuais para `src/app/`.
>
> Construa a tela 1 (Entrar) com o bloco de demonstração de quatro perfis, e a
> tela 21 (Perfil e preferências).
>
> Proteja as rotas do app com `ExigePerfil`.

**Confira:** os quatro botões de demonstração levam a painéis diferentes · abrir
`/app/clinica` sem sessão redireciona para o login · todo o fluxo funciona só com
teclado.

---

## Etapa 4 · Lista e ficha de paciente

> Leia `docs/03-TELAS-SISTEMA.md`, telas 4 e 5.
>
> Construa a lista de pacientes com busca, filtros, paginação e os quatro estados,
> e a ficha do paciente.
>
> O terapeuta vê apenas os pacientes que acompanha; o coordenador vê todos. Deixe
> essa diferença visível no rótulo acima da tabela.

**Confira:** busca sem resultado mostra o estado vazio certo · a tabela rola sozinha
em tela de 400px sem empurrar a página.

---

## Etapa 5 · Telas clínicas passam a consumir serviços

> Leia `docs/03-TELAS-SISTEMA.md`, telas 3, 6, 7 e 8.
>
> Refaça as quatro para consumir a camada de serviços, com os quatro estados.
> Acrescente o que cada especificação pede: formulário de objetivo na 6, seleção de
> objetivo e registro ABC na 7, seletor de objetivo e comparação entre contextos
> na 8.
>
> Atenção especial à comparação entre contextos da tela 8: **três faixas paralelas
> com escalas próprias, nunca a mesma escala nem média entre elas.** Aplique a
> regra de suficiência de cinco registros e três semanas.
>
> No formulário de objetivo, a descrição acessível é obrigatória e **não** pode ter
> botão de gerar automaticamente.

**Confira:** ligue `VITE_MOCK_FALHA=0.3` e recarregue várias vezes — os estados de
erro aparecem e o botão de tentar de novo funciona.

---

## Etapa 6 · Painel de indicadores da clínica

> Leia `docs/03-TELAS-SISTEMA.md`, tela 11, e `docs/02-DESIGN-SYSTEM.md`, seção 5.
>
> Construa o painel do Coordenador Clínico com os quatro blocos, na ordem descrita.
>
> O bloco 2 — o que precisa de atenção — é o mais importante. Cada alerta leva
> direto ao registro correspondente.
>
> Nenhum número sem rótulo de período. Nenhum gráfico sem alternativa em tabela.

**Confira:** todo alerta é clicável · clínica sem dados mostra estado vazio
explicando quando os indicadores aparecem.

---

## Etapa 7 · Completar clínica e coordenação

> Leia `docs/03-TELAS-SISTEMA.md`, telas 9, 10, 12, 13 e 14.
>
> Construa prescrever atividade, emitir relatório, validar planos, registro de
> auditoria e gerenciar usuários.
>
> Na auditoria: registro imutável, sem nenhuma opção de editar ou excluir, e os
> três momentos registrados, inclusive a tentativa negada.
>
> Em usuários: desativar, nunca excluir. Administrador não desativa a si mesmo.

---

## Etapa 8 · Fechar a ponte com a escola

> Leia `docs/03-TELAS-SISTEMA.md`, telas 2, 15, 17, 18 e 19.
>
> Construa o aceite de convite com os quatro estados de token. Ajuste o painel da
> família para mais de um filho. Implemente a janela de 30 minutos para correção da
> ocorrência, mantendo a versão original na auditoria.
>
> Verifique que as seis regras invioláveis do `CLAUDE.md` estão honradas no código,
> e não apenas na interface.

---

## Etapa 9 · Site comercial

> Leia `docs/04-SITE-COMERCIAL.md` por inteiro e `docs/02-DESIGN-SYSTEM.md`.
>
> Construa as cinco páginas públicas usando o texto do documento **como está**.
>
> Reaproveite os componentes de `ui/`. Não crie um segundo conjunto de tokens.
>
> No formulário da lista de espera: sem back-end, não finja que enviou. Mostre a
> confirmação com a linha honesta que o documento especifica.
>
> Sem carrossel, sem animação de rolagem, sem contador animado.

**Confira:** as cinco páginas em 400px de largura, sem rolagem horizontal · cada
uma com título de documento próprio.

---

## Etapa 10 · Revisão final

> Percorra as onze verificações de acessibilidade da seção 6 de
> `docs/02-DESIGN-SYSTEM.md` em todas as telas.
>
> Rode uma verificação automatizada de acessibilidade e corrija as violações
> críticas.
>
> Confira que nenhum componente importa de `servicos/mock` e que nenhum dado
> fictício vazou para fora de `servicos/mock/dados.ts`.
>
> Atualize o `README.md` com a lista final de rotas.

---

## Como pedir correção quando algo sair errado

Não diga "está feio" nem "melhore". Diga o que você viu e o que esperava:

> Na lista de pacientes, em 400px de largura, a tabela empurra a página para o
> lado. Ela deveria rolar dentro do próprio recipiente, como especificado na tela 4.

> O estado vazio da fila de validação diz apenas "nenhum registro". A tela 12 pede
> título, explicação e ação.

E quando ele afirmar que implementou acessibilidade, peça a prova:

> Liste quais critérios da WCAG 2.2 esta tela atende e em que linha do código cada
> um está. Não afirme conformidade que o código não sustenta.

---

## Uma regra para as duas sessões

Quando o Claude Code propuser algo que contraria as seis regras invioláveis do
`CLAUDE.md`, **ele deve parar e avisar** — está instruído a isso. Se ele não parar
e você perceber a contradição, é sinal de que o `CLAUDE.md` precisa ser mais
explícito. Traga o caso para esta conversa e eu ajusto o documento.
