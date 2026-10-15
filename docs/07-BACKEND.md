# 07 · Backend e a virada para o sistema real

Decidido em 13/10/2026. Substitui as etapas 9 e 10 do roteiro original.

---

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
`verificar.yml` (testes) continua; o `deploy.yml` é substituído pelo deploy
automático da hospedagem.

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

**Região do Neon:** escolham uma região **AWS**. A única regra de exclusão por
inatividade que o Neon publica vale para três regiões Azure.

Fontes, conferidas em 13/10/2026: [Render — Deploy for Free](https://render.com/docs/free)
· [Neon — limites do plano gratuito](https://neon.com/faqs/free-plan-limits-and-quotas)
· [histórico de mudanças do plano gratuito do Neon](https://agentdeals.dev/vendor/neon)
· [fim do suporte ao Node 20](https://customerhub.wpvip.com/lobby/2026/01/29/end-of-life-for-node-js-v20/).
Planos gratuitos mudam: confiram de novo na véspera.

### D5 · Autenticação de verdade

- Senha guardada só como **hash argon2id**. O `senhaHash` que está no diagrama de
  classes desde setembro passa a existir, e continua **sem nunca sair** numa
  resposta da API.
- **Sessão no servidor**, com cookie `httpOnly`, `Secure` e `SameSite=Lax`.
- A sessão é guardada **no PostgreSQL**, e não na memória do processo: o Render
  reinicia serviços gratuitos quando quer, e sessão em memória deslogaria todo
  mundo a cada reinício.

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
