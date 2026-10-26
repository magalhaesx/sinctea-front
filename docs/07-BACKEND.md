# 07 · Backend e a virada para o sistema real

Decidido em 13/10/2026. Substitui as etapas 9 e 10 do roteiro original.
**Revisto em 16/10/2026: a seção 0 vale sobre o resto deste documento onde os dois
divergirem.**

---

## 0. Revisão de 16/10 — sistema real, vazio, pronto em 19/10

**O que a orientadora pediu.** O endereço não pode ter dado fictício, e front e
backend precisam estar prontos em **19/10**. Decidido com o Lucas em 16/10:

- **O sistema nasce vazio e é preenchido pelo uso.** Nenhum registro é
  pré-carregado. Profissionais, pacientes, planos, consentimentos e o resto são
  cadastrados pelas telas — pela equipe, pela orientadora ou pela banca.
- **O caminho principal vem primeiro.** O restante entra depois de 19/10.

**O que cai.** Fica revogado o que contradiz isso:

- a semente em produção (passo B5): não se roda;
- a linha "Todos os registros são fictícios" (D9);
- a frase "Os registros continuam fictícios" da seção 1;
- as datas das Etapas 10 a 12.

Os testes continuam com dados fictícios próprios: dado de teste não é dado do site.

**O aviso que entra no lugar.** No rodapé do app, uma linha: *"Ambiente
acadêmico do TCC SINCTEA. Não cadastre dados de pacientes reais."* Até
25/10/2026 ela aparecia também na tela de entrada. Saiu das telas de acesso
(entrar, aceitar convite e definir senha) por decisão do Lucas, porque é
dentro do app que os dados se cadastram.

Não é aviso de demonstração. É o que impede que dado de saúde de criança de verdade
entre num sistema acadêmico sem as bases que a lei pede:

- consentimento do responsável (LGPD, arts. 11 e 14);
- hospedagem nos Estados Unidos (art. 33);
- nenhum comitê de ética aprovou pesquisa com esses dados.

Tirá-la do rodapé é decisão do Lucas com a orientadora, registrada aqui.

**Como o sistema nasce.** Um comando único, rodado uma vez pela máquina do Lucas
contra o Neon, cria a conta do primeiro administrador. O nome, o e-mail e a senha
são digitados na hora, e a senha não aparece na tela. Todo o resto nasce pelas telas.

### Lacunas que o mock escondia

Com o banco vazio, cinco caminhos que a semente cobria precisam existir:

1. **Primeiro acesso por link.** `usuarios.convidar` (equipe) e o cadastro de
   responsável devolvem um link de uso único, válido por 72 horas. O administrador
   ou o terapeuta o entrega à pessoa, que define a própria senha. Quem cadastra
   nunca conhece a senha de ninguém. O token é guardado só como resumo SHA-256.
   O professor continua nascendo do convite da família, como já é.
2. **Responsável do paciente.** Na ficha, o terapeuta cadastra o responsável:
   - nome, e-mail, telefone, parentesco e se é o responsável legal;
   - a operação cria o usuário, ou reaproveita o que já tem aquele e-mail, e o
     `VinculoFamiliar`;
   - ela devolve o link de primeiro acesso.
3. **Criar o plano.** O paciente sem plano mostra a situação `SEM_PLANO` e o botão
   "Criar plano", com data de início e de revisão. O plano nasce em `RASCUNHO`.
4. **Cadastrar escola.** No formulário de consentimento, "Não encontrou a escola?"
   abre nome, rede e município. Quem cadastra é o próprio responsável, porque a
   família nomeia a instituição (art. 7 e 8). A operação é auditada.
5. **Escrever o cartão de estratégias.** Antecipado da Etapa 11, porque sem ele a
   escola não lê nada. O terapeuta cria e edita o cartão de cada objetivo com:
   - título;
   - ao menos um "o que fazer" e um "o que evitar";
   - o sinal de alerta.

   O rascunho fica no formulário até salvar, e `iniciarCartao` sai.

### O caminho principal, até 19/10

| Ordem | O quê |
|---|---|
| 1 | Autenticação de verdade (D5): entrar, sair, sessão atual, primeiro acesso. Os *guards* (D7), o interceptador de auditoria e o comando do primeiro administrador |
| 2 | Usuários: listar, convidar, perfis, desativar, reativar. Profissionais: listar. Meus dados profissionais |
| 3 | Pacientes: listar, obter, criar e cadastrar responsável. Plano: criar, obter, objetivos, enviar, aprovar, devolver, confirmar domínio e cartão. Sessão: iniciar, registrar, desfazer, pausar, encerrar e listar por paciente |
| 4 | Família: filhos e objetivos acessíveis. Escolas: listar e cadastrar. Consentimento: conceder, listar, revogar e reemitir convite. Convite: obter e aceitar. Área da escola: alunos, cartão, registrar e corrigir ocorrência |
| 5 | O front publicado só com a API, e o deploy |

**O que fica para depois de 19/10:** indicadores, relatórios, atividades de casa,
ocorrências comportamentais, evolução, avisos da escola, a tela de auditoria e a
agenda. Até cada serviço chegar, a tela dele **some da navegação e das rotas na
versão publicada**. Nunca aparece com dado simulado.

**O que não se corta, nem com pressa:**
- as regras 1, 2, 3, 5 e 6 provadas por teste de integração contra a API, no
  caminho principal;
- o *trigger* da auditoria;
- o papel que não é dono do banco;
- senha só em argon2id.

**O front publicado.** Em produção, `servicos/index.ts` usa só a API, e o mock
não entra no pacote. Também saem da versão publicada `entrarDemonstracao`, os
avisos de demonstração e `/dev/estados`. No desenvolvimento e nos testes, o mock
continua até a Etapa 12, que só termina de removê-lo.

**Até a virada, o endereço do Render não vai para ninguém.** Antes dela, ele
ainda serve o front com o mock. O GitHub Pages antigo, que mostra os dados
fictícios, é despublicado já (feito em 17/10).

## 1. O que mudou

A orientadora pediu duas coisas: que o sistema **não seja simulado** e que tenha
**backend**. As duas são a mesma coisa vista de lados diferentes. Hoje a camada de
dados roda no navegador, e recarregar a página apaga o que foi feito. A partir
daqui, o sistema grava num banco de verdade, num servidor, e a implementação
simulada sai.

Escopo, decidido com o Lucas em 13/10:

- **Tudo** vai para o backend. As 22 telas passam a falar com a API real, e
  `servicos/mock` é removido no fim.
- Saem da interface os **avisos de demonstração** e a vitrine `/dev/estados`.
- Hospedagem em **nuvem gratuita**.
- Quem implementa é o **Lucas, pelo Claude Code**, no mesmo fluxo do front.

### O que não muda

**Os registros continuam fictícios.** "Não simulado" quer dizer banco real, e não
dado real. Gravar dado de saúde de criança de verdade num trabalho acadêmico, sem
consentimento das famílias, é o que a LGPD proíbe e o que a regra de convenção do
`CLAUDE.md` já proíbe. Os personagens de hoje — Patrícia, Miguel, Rosa, Gustavo,
Noah — passam a morar num PostgreSQL, e não num arquivo TypeScript.

As seis regras invioláveis não mudam. O que muda é **onde** elas são aplicadas: no
servidor, que é onde finalmente viram fronteira de confiança.

---

## 2. A vantagem que já temos

O backend não começa do zero. A implementação simulada é uma **especificação
executável**: cada regra de acesso, cada verificação de consentimento, cada
registro de auditoria já está escrito e coberto por 177 testes. O trabalho é
portar, não inventar.

E as regras de domínio — **todo o `src/dominio/`**, inclusive o `auditoria.ts` —
são TypeScript puro, sem dependência de navegador. O servidor **importa o mesmo
código**, e não uma reescrita dele. É a mesma regra nos dois lados, com o mesmo
teste.

---

## 3. Decisões

### D1 · Stack: NestJS, Prisma e PostgreSQL, sobre Node 22

É o que o `CLAUDE.md` já previa, e trocar de framework agora abriria uma
divergência a justificar. Uma correção: **Node 22 LTS, não Node 20.** O Node 20
chegou ao fim do suporte em 30/04/2026 e não recebe mais correções de segurança.
Os dois fluxos do GitHub Actions ainda usam Node 20; passam para 22 no primeiro
commit de código da Etapa 9.

### D2 · Um repositório, três pacotes

```
sinctea-front/            (a raiz continua sendo o front, no mesmo lugar)
├── src/                  front
├── compartilhado/        tipos, contratos e domínio — usados pelos dois lados
└── servidor/             NestJS
```

`npm workspaces` na raiz. Tipos, contratos e domínio **saem de `src/` para
`compartilhado/`**, e front e API importam de lá. Assim, se o contrato de um
serviço mudar, o compilador acusa nos dois lados ao mesmo tempo — é impossível o
front e a API discordarem em silêncio.

O front não muda de lugar, para não quebrar caminhos e fluxos de CI.

A pasta do NestJS se chama `servidor/`, e não `api/`: `src/servicos/api/` já é o
cliente do front, e duas pastas `api/` no mesmo repositório deixariam ambíguo de
que lado da rede cada uma está. A rota continua em `/api`.

### D3 · Um endereço só

O servidor NestJS entrega o front já compilado e responde à API em `/api`, no
mesmo domínio.

Três razões. **Cookie de sessão:** com front e API em domínios diferentes (o
front no `github.io`, a API em outro), o cookie vira de terceiro, e os navegadores
estão bloqueando cookie de terceiro. No mesmo domínio, o cookie é `httpOnly` e
`SameSite=Lax` e simplesmente funciona. **Sem CORS:** nenhuma configuração de
origem cruzada para errar. **Coerência:** o `docs/01` já dizia *"um repositório,
um build, um endereço"*.

Consequência: o GitHub Pages deixa de ser o endereço do sistema. O fluxo
`verificar.yml` (testes em *pull request*) continua; o `deploy.yml` virou o
workflow **Publicar**, que testa, constrói e roda a imagem e migra o banco antes de
o Render publicar (D4).

### D4 · Hospedagem: Render para o servidor, Neon para o banco

| | Render (servidor) | Neon (banco) |
|---|---|---|
| Custo | gratuito | gratuito |
| Limite | 750 h/mês por conta | 1 GB por projeto; 100 h de computação/mês |
| Dorme | após 15 min sem acesso | após 5 min sem acesso |
| Acordar | cerca de 1 minuto | rápido |
| Expira | não | não, nas regiões AWS |

**Por que não o banco gratuito do próprio Render:** ele **expira 30 dias depois de
criado** e é apagado com todos os dados após mais 14 dias. Criado agora, sumiria
antes da banca.

**O risco que fica — e como se trata:** o servidor do Render dorme depois de 15
minutos parado e leva cerca de um minuto para acordar. **No dia da banca, abra o
endereço uns cinco minutos antes.** As 750 horas mensais cobrem um serviço ligado
o mês inteiro (31 × 24 = 744 h), se preferirem mantê-lo acordado na semana da
apresentação.

**Regiões, decididas em 15/10:**
- Render em **Virginia**;
- Neon em **AWS US East (N. Virginia)**, `aws-us-east-1`.

Servidor e banco ficam na mesma região, porque cada consulta atravessa essa
distância, e uma tela faz várias consultas. O Neon tem São Paulo, mas o Render
não tem região na América do Sul. Separar os dois custaria mais em latência do
que aproximar do usuário ganharia. Nas regiões Azure, o Neon apaga projeto
inativo, e não se cria mais projeto nelas.

**Com dado real, isso teria de ser revisto:** hospedar dado de saúde nos Estados
Unidos é transferência internacional (LGPD, art. 33). Com registros fictícios, não
se aplica. Fica declarado como limitação no artigo.

**Migrações fora do Render.** O comando de pré-deploy do Render é só do plano
pago. As migrações rodam no GitHub Actions, com o papel dono do banco, depois dos
testes. O Render publica com o auto-deploy em *After CI Checks Pass*: só sobe
código cujo commit passou nos testes e já migrou o banco. Assim, a credencial de
dono nunca entra no servidor.

Fontes, conferidas em 13/10/2026: [Render — Deploy for Free](https://render.com/docs/free)
· [Neon — limites do plano gratuito](https://neon.com/faqs/free-plan-limits-and-quotas)
· [histórico de mudanças do plano gratuito do Neon](https://agentdeals.dev/vendor/neon)
· [fim do suporte ao Node 20](https://customerhub.wpvip.com/lobby/2026/01/29/end-of-life-for-node-js-v20/).
Conferidas em 15/10/2026: [Render — deploys e pré-deploy](https://render.com/docs/deploys)
· [Neon — regiões](https://neon.com/docs/introduction/regions)
· [Neon — acesso ao banco e papéis](https://neon.com/docs/manage/database-access).
Planos gratuitos mudam: confiram de novo na véspera.

### D5 · Autenticação de verdade

- Senha guardada só como **hash argon2id**. O `senhaHash` que está no diagrama de
  classes desde setembro passa a existir, e continua **sem nunca sair** numa
  resposta da API.
- **Sessão no servidor**, com cookie `httpOnly`, `Secure` e `SameSite=Lax`.
- A sessão é guardada **no PostgreSQL**, e não na memória do processo: o Render
  reinicia serviços gratuitos quando quer, e sessão em memória deslogaria todo
  mundo a cada reinício.
- **Uma conta por aba** (item 9, revisão de 24/10/2026). No mesmo navegador, uma
  aba de administrador, uma de profissional e uma de responsável funcionam ao
  mesmo tempo. O navegador tem **cinco vagas**, cada uma o seu cookie,
  `sinctea_sessao_1` a `sinctea_sessao_5`, todos `httpOnly`, `Secure` e
  `SameSite=Lax`. Ao abrir sessão — entrar, primeiro acesso, nova senha, aceite
  de convite —, o servidor usa a primeira vaga sem sessão válida e devolve o
  número dela na resposta, e confere a vaga antes de gastar o link ou o convite.
  Com as cinco ocupadas, recusa: *"Já há 5 contas abertas neste navegador. Saia
  de uma delas para entrar com outra."*
- A aba guarda **só o número da vaga** em `sessionStorage` e o manda em toda
  chamada, no cabeçalho `X-Sinctea-Aba`. O servidor resolve a sessão só pelo
  cookie dessa vaga: sem o cabeçalho, ou com uma vaga sem cookie válido, não há
  sessão. **O token nunca vai para `sessionStorage` nem para `localStorage`**:
  fica no cookie, que o JavaScript não lê. Recarregar a aba mantém a conta; a
  aba duplicada leva a mesma vaga, porque o navegador copia o `sessionStorage`.
- A aba sem vaga lê `GET /api/auth/contas-abertas`, público, que devolve de cada
  vaga válida só o número, o nome e o perfil ativo — nunca o token —, e oferece
  *"Continuar como <nome>"*. Sair e trocar de perfil valem só para a vaga da
  aba; desativar a conta ou trocar a senha encerra todas as sessões da pessoa,
  em qualquer vaga. O cookie de antes, `sinctea_sessao`, é apagado onde
  aparecer, com a linha dele: quem estava dentro entra de novo uma vez.

### D6 · O login de demonstração sai

`entrarDemonstracao` entra numa conta sem senha. Num servidor público, isso
significa que **qualquer pessoa na internet entra como coordenação e lê a trilha
de auditoria inteira**. Os dados são fictícios, mas o endpoint desmentiria cada
afirmação de segurança do artigo.

Sai. A banca recebe os e-mails das contas e a senha num cartão ou num slide — não
na tela de login.

### D7 · As regras viram fronteira de confiança

Os auxiliares de acesso — `exigirSessao`, `exigirPerfil`, `alcancaClinicamente`,
`ehResponsavelDe`, `exigirAcessoEscola` e a verificação de responsável legal —
viram *guards* e serviços do NestJS. A partir daqui, o que o `docs/06` classifica
como "convenção de front-end" passa a valer contra quem controla o navegador.

**Auditoria de toda leitura e escrita.** O pré-projeto promete *100% das
operações de leitura e escrita sobre dado sensível registradas*. A redação
"piso, não teto" da regra 6, adotada em 13/10 sem o pré-projeto à vista, fica
revogada. No servidor isso é barato: um **interceptador** registra toda leitura e
escrita de dado do paciente, sem depender de cada função lembrar de auditar.

**Auditoria só cresce, de verdade.** Um *trigger* no PostgreSQL recusa `UPDATE`,
`DELETE` e `TRUNCATE` na tabela de auditoria — e na de relatórios emitidos, que
também não podem mudar depois de saírem. Um teste de integração tenta cada
operação e espera a recusa. É o que sobe a regra 6 de "garantida por construção" para
"provada por teste" — e resolve o limite que a seção 6.1.3 do artigo declara hoje.

### D8 · Os testes atravessam

- Os testes do domínio vão junto com `compartilhado/`.
- O `regrasInviolaveis.test.ts` é **portado como teste de integração da API**,
  contra um banco de teste. É ele que diz quando a API está pronta: quando passa a
  mesma suíte que o mock passava.
- No CI, o PostgreSQL de teste sobe como serviço do próprio GitHub Actions. Na
  máquina de desenvolvimento, é um PostgreSQL 17 embutido (pacote
  `embedded-postgres`), sem instalação nem Docker. Os dois na versão 17, a mesma
  do Neon.
- Na virada, as **22 quebras** do `docs/06` são refeitas contra o servidor.

### D9 · Uma linha de transparência

Os avisos de demonstração saem, como pedido. Mas o endereço é público, e um
estranho que caia nele vai ver o que parece prontuário de criança. **Fica uma
linha discreta no rodapé:** *"Instância acadêmica do TCC SINCTEA. Todos os
registros são fictícios."* Não é aviso de demonstração — é o que impede um
visitante de achar que encontrou um vazamento. Se a orientadora pedir para tirar,
tira.

---

## 3A. O que o pré-projeto acrescenta

Levantado em 13/10, depois desta decisão. O detalhe está em
`docs/08-ADERENCIA-AO-PRE-PROJETO.md`. O que entra no plano, já decidido:

- **Itens baratos do pré-projeto:** documentação OpenAPI (`@nestjs/swagger`),
  `Dockerfile` da API (o Render implanta a partir dele), relatório de cobertura e
  verificação com axe-core e Playwright na integração contínua.
- **DER e dicionário de dados:** entregues pelo Cowork, **gerados do esquema
  Prisma** logo depois do commit 4 da Etapa 9, para não divergirem do banco.
- **Offline reduzido ao registro de sessão** (tela 7): manifesto e service worker
  para instalar como PWA, fila no IndexedDB, e **chave de idempotência gerada no
  aparelho** como política de conflito — a mesma sessão enviada duas vezes grava
  uma só. Entra depois da Etapa 11.
- **Avaliação com usuários** (SUS e testes de tarefa cronometrados) na semana do
  pré-projeto, E13. O recrutamento — inclusive de **cinco educadores** — começa
  agora.

**Duas decisões aguardam a orientadora:** a data final (23/11 ou 30/11) e a
Trilha de Autonomia (versão mínima derivada ou desvio declarado). As datas das
etapas abaixo serão revistas quando ela responder.

## 4. Etapas

Hoje é 13/10. A entrega é 23/11. A última semana fica livre para o artigo, os
slides e o ensaio.

### Etapa 9 · Fundação — até 19/10

1. `docs/07` no repositório e o `CLAUDE.md` atualizado (stack, Node 22,
   hospedagem, endereço único).
2. O que sobrou da Etapa 8: `MotivoNegativa` no `ErroServico`, a tela 18 de
   acesso encerrado e o foco na confirmação da tela 17. **A trilha privada no mock
   não é feita** — o mock vai embora, e no servidor a proteção é o *trigger*.
3. `npm workspaces` e a pasta `compartilhado/`, com tipos, contratos e domínio. Os
   177 testes continuam verdes.
4. O esquema Prisma das 22 classes, a primeira migração, a semente portada do
   `dados.ts` e `/api/saude` lendo o banco, tudo contra o PostgreSQL embutido. A
   primeira migração já traz o *trigger* que torna imutáveis a auditoria e o
   relatório emitido, antecipado da Etapa 10.
5. **Deploy de ponta a ponta antes de qualquer serviço:** o endereço público abre
   o front, e `/api/saude` responde lendo o banco. No Neon, a aplicação conecta
   com um papel que **não é dono** das tabelas, porque o dono poderia desligar o
   *trigger*; as migrações rodam com o dono.

**Pronto quando:** o endereço público existe e lê o Neon. Fazer o deploy no
começo, e não no fim, é o que tira o maior risco do cronograma da frente.

### Etapa 10 · Autenticação e fronteira — até 26/10

Autenticação (D5), os *guards* (D7), o serviço de auditoria com o interceptador
(o *trigger* já entrou na Etapa 9), e os
módulos do caminho crítico das regras: pacientes, consentimentos, convites e área
da escola. Os testes das regras 1, 2, 3, 5 e 6 portados e verdes contra a API.

**Pronto quando:** as duas histórias da banca rodam contra o servidor real.

### Etapa 11 · Os outros serviços — até 09/11

Clínica (planos, sessões, evolução, atividades), relatórios, indicadores,
gestão de usuários, área da família. O restante da suíte portado.

**O cartão de estratégias passa a ser escrito pelo sistema.** Hoje o contrato só
tem `iniciarCartao`, que cria um cartão em branco, e nenhuma tela o chama: o que
a escola lê veio da semente. Entram criar e editar o cartão **com conteúdo** —
título, ao menos um "o que fazer", ao menos um "o que evitar" e o sinal de
alerta —, e o rascunho fica no formulário até ser salvo, sem cartão em branco no
banco. A tela vem especificada no `docs/03` antes do início desta etapa.

**Pronto quando:** a suíte inteira passa contra a API.

### Etapa 12 · A virada — até 15/11

O front passa a usar só a API. `servicos/mock` é removido, junto com
`entrarDemonstracao`, os avisos de demonstração e `/dev/estados`. As 22 quebras do
`docs/06` refeitas contra o servidor, e o documento atualizado — as categorias
sobem. Diagrama de componentes revisado: o que era "previsto" deixa de ser.

**Pronto quando:** tag `v1.0`, e nenhum arquivo do repositório importa
implementação simulada.

### Etapa 13 · Entrega — de 16/11 a 23/11

Artigo atualizado (6.1.3, limitações, resultados, cronograma, ferramentas e a
Figura 3), slides, vídeo e ensaio. Uma página institucional, só com dado real e
citado, **se sobrar tempo**.

---

## 5. Se atrasar, o que corta primeiro

Nesta ordem:

1. A página institucional (Etapa 13).
2. A exportação CSV da auditoria — a tela 13 continua, sem o botão.
3. O painel de indicadores (tela 11) reduzido aos três números principais.

**Não se corta:** autenticação, as seis regras no servidor, o *trigger* da
auditoria e as duas histórias da banca. Sem eles, o backend não entrega o que a
orientadora pediu.
