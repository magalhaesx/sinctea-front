# Aderência ao pré-projeto

**O que o pré-projeto prometeu, o que existe hoje e o que se propõe**

SINCTEA · Eduardo da Cruz Monteiro e Lucas Magalhães Pinto · orientadora: Profa. Luana Leal
Levantamento de 13/10/2026, feito a partir do pré-projeto entregue em 17/08/2026 e do código do repositório.

---

## Por que este documento existe

A banca avalia o trabalho contra o pré-projeto. O pré-projeto fixou dez objetivos específicos, treze metas de validação com número e instrumento, e uma lista de tecnologias. Parte disso está atendida, parte está em andamento e parte não vai caber até a entrega.

O que não couber precisa aparecer na monografia como **desvio declarado e justificado** — e a orientadora precisa concordar com cada desvio **antes** da defesa, não durante. É para isso que este documento serve.

Cada linha traz uma de três propostas: **fazer**, **fazer reduzido** ou **desvio declarado**.

---

## Duas decisões que são da orientadora

### 1. A data final

O `CLAUDE.md` do repositório registra **23/11/2026** como entrega final. O cronograma do pré-projeto põe a avaliação com usuários (SUS e testes de tarefa) na semana **E13, 23/11**, e a versão final da monografia, a demonstração e o ensaio da defesa na **E14, 30/11**.

Uma semana de diferença decide se a trilha de autonomia e a operação offline cabem. **Qual é a data?**

### 2. A Trilha de Autonomia

O pré-projeto a coloca no **objetivo geral** ("apoiando a transição para a vida autônoma e para o mercado de trabalho"), no **objetivo 5.6**, e na **meta de escopo**, que exige "obrigatoriamente os módulos Ponte Clínica-Escola e Trilha de Autonomia". É também a base da **meta 8.5 da ODS 8**. Em setembro ela foi movida para trabalhos futuros, e hoje não existe no modelo.

**Recomendação: uma versão mínima, derivada do que já existe.**

- O **Currículo de Habilidades Funcionais** é a projeção dos objetivos já dominados de cada pessoa: a redação acessível, o domínio e a data em que o objetivo foi dominado (o campo `dominadoEm`, que já existe), agrupados por domínio.
- O **Perfil de Suporte no Trabalho** é a projeção das estratégias dos cartões, **tal como o terapeuta as escreveu** — nada é gerado automaticamente, o que preserva a regra de que a redação acessível é sempre escrita por um profissional.

Nenhuma entidade de autoria nova: uma tela, uma impressão e um endpoint. Estimativa: três dias. Atende à meta de escopo e dá sustentação à ODS 8.5.

**Alternativa:** desvio declarado, com a reescrita do objetivo geral na monografia e a retirada da ODS 8.5 da justificativa.

---

## Objetivos específicos

| Nº | Prometido | Hoje | Proposta |
|---|----------|--------------|------------|
| 5.1 | Requisitos, regras de negócio e **matriz de rastreabilidade** (requisito, regra, caso de uso e caso de teste), levantados com terapeutas, familiares e educadores | **Parcial.** 23 requisitos funcionais, 14 não funcionais e 15 regras de negócio especificados. Questionário com 19 profissionais de uma clínica, sem familiares nem educadores externos. Matriz não feita | **Fazer** a matriz, até 26/10. A ausência de familiares no levantamento já está declarada no artigo, seção 4.6 |
| 5.2 | BPMN do processo atual e do proposto | **Não iniciado** (semana E04) | **Fazer**, até 26/10. O processo atual sai das respostas abertas do questionário; o proposto, do fluxo do sistema |
| 5.3 | C4 nos três níveis, UML e DER | **Parcial.** Classes (revisão de 15/10), componentes e atividades (05/10). **DER e dicionário de dados entregues em 15/10** (`docs/uml/` e `docs/09`), gerados do catálogo do PostgreSQL com as três migrações, para não divergirem do banco. Casos de uso e sequência existem desde 10/09, anteriores às revisões do modelo. Faltam C4 e estados do Objetivo | **Fazer.** C4, estados e revisão dos dois diagramas antigos até 02/11 |
| 5.4 | Núcleo clínico e **operação offline com sincronização posterior** | **Parcial.** Núcleo pronto no front; servidor em construção. Offline não iniciado: não há service worker nem fila | **Fazer reduzido**: offline só no registro de sessão, que é o caso descrito na justificativa do pré-projeto (terapeuta no tablet, sem conexão estável). Ver a nota sobre conflito, abaixo |
| 5.5 | Ponte clínica-escola | **Atendido no front** (telas 2, 17, 18, 19 e 22) | Concluir no servidor (Etapa 10) |
| 5.6 | Trilha de autonomia | **Não iniciado** | **Decisão da orientadora** (acima) |
| 5.7 | Autenticação, controle de acesso por perfil e atributo, consentimento, auditoria, LGPD, publicação em nuvem | **Parcial.** Consentimento e auditoria prontos e verificados (`docs/06`). Autenticação e nuvem em construção. Não há isolamento por instituição: o modelo não tem entidade de instituição | Concluir no servidor. **Desvio declarado:** a entrega atende uma instituição; o isolamento por instituição fica como trabalho futuro |
| 5.8 | Painéis: evolução, adesão e sobrecarga do cuidador | **Parcial.** Evolução por objetivo pronta (tela 8). A tela 11 já aponta "paciente sem sessão há mais de 15 dias", que é o sinal de risco de evasão. Adesão às atividades de casa: o dado existe, o painel não. Sobrecarga do cuidador: não há fonte de dado | **Fazer** o painel de adesão. **Desvio declarado** para a sobrecarga do cuidador — ver nota abaixo |
| 5.9 | WCAG 2.2 AA, COGA e GAIA; avaliação com usuários reais por **SUS**, **testes de tarefa cronometrados** e verificação automatizada | **Parcial.** Conformidade trabalhada nas telas e em documento próprio. Não há verificação automatizada. SUS e testes de tarefa não iniciados | **Fazer.** axe-core na integração contínua; SUS e testes de tarefa sobre o sistema publicado, na semana E13 |
| 5.10 | Viabilidade técnica, econômica, operacional e legal; ODS 3.4, 3.8 e 8.5 | **Não iniciado** (semana E04). A ODS 8.5 está sem sustentação, porque depende da 5.6 | **Fazer**, até 02/11, com o custo mensal de infraestrutura por instituição |

**Nota sobre o conflito no offline.** O pré-projeto exige "política declarada de resolução de conflito". Registro de sessão é só inclusão — ninguém edita a sessão de outro terapeuta ao mesmo tempo. O conflito que existe de verdade é o reenvio: a rede cai no meio do envio, e o aparelho manda de novo. A política é uma **chave de idempotência gerada no aparelho**: a mesma sessão enviada duas vezes grava uma vez só. É exatamente o que a meta pede — "sem perda nem duplicação".

**Nota sobre a sobrecarga do cuidador.** Medi-la exige aplicar um instrumento às famílias, o que é coleta de dado de saúde de terceiros. O próprio pré-projeto restringe a avaliação empírica a profissionais e educadores maiores de idade justamente para não depender do Comitê de Ética, cujo prazo é incompatível com o trabalho. O desvio decorre dessa delimitação.

---

## Metas de validação

| Meta do pré-projeto | Situação e proposta |
|----------|---------------|
| **Escopo:** no mínimo 18 de 24 casos de uso, obrigatoriamente Ponte e Trilha | O modelo tem hoje 21 casos de uso, sem a trilha. **Sem a trilha, a meta não é atingida como foi escrita** — depende da decisão 2 |
| **Cobertura** de testes ≥ 60% nas regras críticas | Provável, com 177 testes, mas **ainda não medida**. Fazer: relatório de cobertura na integração contínua |
| **Offline:** 100% de 20 sessões sincronizadas, sem perda nem duplicação | Com o 5.4 reduzido: teste de integração automatizado com rede intermitente simulada |
| **SUS** ≥ 68 por perfil, 75 no terapeuta | Semana E13 |
| **Tempo de registro de sessão** 40% menor que no processo atual | Semana E13. Exige cronometrar também o processo atual, no prontuário físico — combinar com a clínica |
| **Professor registra ocorrência** em até 30 s, com no mínimo **cinco educadores** | Semana E13. **Risco:** o questionário teve dois respondentes da área educacional. É preciso recrutar educadores agora |
| **Acessibilidade:** zero violações críticas ou sérias; navegação integral por teclado | axe-core na integração contínua e verificação manual |
| **Auditoria:** 100% das leituras e escritas sobre dado sensível registradas | **Corrige uma decisão de 13/10** — ver abaixo |
| **Desempenho:** primeiro conteúdo em menos de 2 s em 3G; instalável como PWA | Google Lighthouse. A instalação como PWA vem com o 5.4 |
| **Indicadores:** três painéis — evolução, adesão e risco de evasão, sobrecarga do cuidador | Dois de três com a proposta; o terceiro é desvio declarado |
| **Otimização processual:** processo proposto com ao menos duas etapas de retrabalho a menos | Depende do BPMN (5.2) |
| **Viabilidade** nas quatro dimensões, com custo mensal por instituição | Depende do 5.10 |
| **Participação:** no mínimo 15 entre terapeutas, educadores e familiares, com registro de consentimento | O questionário de outubro teve 19 profissionais, sem familiares, e não registrou consentimento formal. Na E13: termo de consentimento simples, participante adulto, sobre usabilidade. A ausência de familiares é declarada |

### A meta de auditoria corrige uma decisão de 13/10

Em 13/10 a regra 6 foi reescrita como "piso, não teto": só a leitura por quem está fora da clínica precisaria ficar registrada. **O pré-projeto promete 100% das leituras e escritas sobre dado sensível**, e aquela redação foi feita sem ele à vista. Ela é revogada.

No servidor, isso é barato: um interceptador registra toda leitura e escrita de dado do paciente, sem depender de cada função lembrar de auditar. A tela 13 já tem os filtros — por paciente, por ação, só tentativas negadas — para lidar com o volume.

---

## Tecnologias

| Pré-projeto | Proposta |
|---------|----------------|
| React 18, TypeScript, Vite, TailwindCSS | Atendido |
| vite-plugin-pwa, Workbox, Service Worker, IndexedDB com Dexie.js | Com o 5.4 reduzido |
| **Node.js 20** com NestJS e OpenAPI | **Node.js 22** — o 20 deixou de ter suporte em 30/04/2026. NestJS em construção. OpenAPI pelo módulo `@nestjs/swagger`: fazer |
| PostgreSQL 16 com Prisma | Atendido, no Neon |
| Vitest, Supertest, Playwright, axe-core | Vitest atendido. Supertest com a API. Playwright e axe-core: fazer |
| Git, GitHub, GitHub Actions | Atendido |
| Mermaid e draw.io | Diagramas gerados por código, em SVG. Desvio menor: o resultado é o mesmo, e o código do diagrama fica versionado |
| Figma e guia de estilo acessível | Guia de estilo em `docs/02-DESIGN-SYSTEM.md`, aplicado no código. Desvio menor |
| Python 3.12, FastAPI e pandas para o serviço analítico | **Desvio:** os indicadores são calculados na própria API. Uma linguagem e um serviço só — um segundo serviço gratuito também dormiria e também precisaria ser mantido acordado |
| Recharts ou Chart.js, com alternativa textual | Gráficos próprios em SVG, com tabela alternativa. Desvio menor |
| JWT com refresh rotativo, Argon2id, RBAC/ABAC e TOTP | Argon2id e controle por perfil e atributo: atendidos. **JWT substituído por sessão no servidor** com cookie `httpOnly`: front e API no mesmo endereço, e encerrar uma sessão tem efeito imediato. TOTP: trabalho futuro |
| Redis com BullMQ | **Desvio:** não há processamento assíncrono no escopo entregue. A fila do offline fica no aparelho |
| Docker, Render ou Railway, PostgreSQL gerenciado (Neon ou Supabase), armazenamento S3 | **Render e Neon, exatamente o previsto.** Docker: fazer (o Render implanta a partir do Dockerfile). S3: desvio — não há arquivo a guardar |
| pdfmake ou Puppeteer | **Desvio:** o relatório emitido é guardado com o conteúdo e o resumo criptográfico, e a impressão em PDF é feita pelo navegador |

---

## Também precisa aparecer na monografia

- **O nome mudou.** O pré-projeto se chama **Percurso**; o sistema entregue se chama **SINCTEA**. A monografia precisa registrar a mudança e a razão.
- **A avaliação com usuários tem dia marcado** — E13, 23/11 — e depende de recrutar profissionais e, sobretudo, **cinco educadores**. O recrutamento precisa começar agora.
- **Contingência.** O pré-projeto já prevê congelar o código na E13 e gravar um vídeo da demonstração, para o caso de a nuvem falhar no dia. Fica mantido.
