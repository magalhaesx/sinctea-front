# SINCTEA — Sistema Integrado de Continuidade Terapêutica no TEA

Trabalho de Conclusão de Curso · Sistemas de Informação (Noturno) · Centro
Universitário FAMETRO
Eduardo da Cruz Monteiro (2382960) · Lucas Magalhães Pinto (2394090)
Orientadora: Profa. Luana Leal · Entrega final: 23/11/2026

> **Leia este arquivo inteiro antes de escrever código.** Ele contém regras que não
> podem ser inferidas do código, e várias têm consequência legal.

---

## Documentos deste repositório

| Documento | Quando ler |
|---|---|
| `docs/01-ARQUITETURA.md` | Antes de criar qualquer pasta, rota ou serviço |
| `docs/02-DESIGN-SYSTEM.md` | Antes de escrever qualquer CSS ou componente |
| `docs/03-TELAS-SISTEMA.md` | Antes de construir cada tela |
| `docs/04-SITE-COMERCIAL.md` | Suspenso em 13/10/2026 — ver `docs/07`, Etapa 13 |
| `docs/05-ROTEIRO-CLAUDE-CODE.md` | A ordem das etapas de implementação |
| `docs/06-VERIFICACAO-DAS-REGRAS.md` | Ao afirmar que uma regra está garantida |
| `docs/07-BACKEND.md` | Antes de qualquer trabalho no servidor |
| `docs/08-ADERENCIA-AO-PRE-PROJETO.md` | Ao afirmar que um objetivo do pré-projeto foi atendido |
| `docs/PROMPT.md` | O prompt que originou a interface (entrega acadêmica) |
| `docs/USO-DA-IA.md` | Como a IA foi empregada, e onde errou |

---

## 1. O que o sistema é

Sistema de informação web para gestão e acompanhamento terapêutico de pessoas
com Transtorno do Espectro Autista, em contexto multidisciplinar. Previsto como
PWA, com registro de sessão offline (`docs/07`, seção 3A).

O diferencial não é a clínica: é a **continuidade entre os três ambientes** em que
a pessoa vive — clínica, casa e escola. O sistema não faz diagnóstico e não
substitui julgamento profissional.

**Fundamento:** segundo o Mapa Autismo Brasil (Instituto Autismos, 2026), 56,5% das
pessoas com TEA recebem no máximo duas horas semanais de terapia e 16,4% não
recebem nenhuma. A maior parte do tempo de vigília transcorre fora do ambiente
terapêutico.

O repositório contém o sistema em `/app` e, em `/`, uma página institucional, se
houver tempo (`docs/07`, Etapa 13). Os dois compartilham design system e deploy.
Ver `docs/01-ARQUITETURA.md`.

### Fora de escopo, declarado
Módulo financeiro, faturamento e TISS · homologação RNDS · aplicativos nativos ·
telessupervisão com vídeo · correlação de contexto com aprendizado de máquina ·
integração com wearables · fila de processamento assíncrono (Redis + BullMQ).

## 2. Atores e áreas

| Área | Ator | Dispositivo | Característica |
|---|---|---|---|
| Clínica | Terapeuta, Coordenador, Administrador | Desktop / tablet | Densidade alta, registro rápido, offline |
| Família | Responsável | Celular | Linguagem cotidiana, uma decisão por tela |
| Escola | Professor / AEE | Celular | Consulta em segundos, zero conteúdo clínico |

Três áreas de navegação **independentes**, não um sistema único com menus ocultos
por permissão. A separação é estrutural e sustenta a minimização de dados da LGPD.

## 3. Regras invioláveis

**Se um pedido conflitar com qualquer uma destas, pare e avise. Não decida
sozinho.**

1. **Quem autoriza o acesso da escola é o Responsável legal — nunca a escola.**
   Responsável legal é quem tem `responsavelLegal` verdadeiro no `VinculoFamiliar`
   com aquele paciente: a autoridade é da relação, não do perfil. O professor cria
   conta a partir de convite de uso único, com expiração em 72 horas. Não existe
   autocadastro de professor.

2. **Nenhum dado atravessa a fronteira do contexto clínico sem verificação de
   consentimento vigente e de escopo.** A verificação ocorre a cada leitura, antes
   de qualquer retorno de dado. É o UC21 e o passo 15 do diagrama de sequência.
   A lista de alunos do professor (UC22) é calculada a partir dos vínculos do
   próprio professor e carrega nome do aluno, escola, turma, turno, situação do
   consentimento e validade — sem nenhum conteúdo clínico. É a exceção prevista no
   passo 27 do diagrama de sequência.

3. **A escola nunca acessa evolução, plano terapêutico, diagnóstico, laudo ou
   histórico de sessões.** Restrição de estrutura de dados, não de tela.

4. **Todo objetivo tem duas redações gravadas separadamente:** `descricaoTecnica`
   (equipe) e `descricaoAcessivel` (família e escola). A acessível é escrita pelo
   terapeuta — **nunca gerada automaticamente**. Não crie botão que a gere.

5. **A revogação de consentimento produz efeito imediato.** Sem carência, sem cache
   que sobreviva a ela.

6. **Toda leitura e escrita de dado do paciente é registrada**, assim como a
   concessão de acesso e a **tentativa de acesso negada**. Registro imutável. No
   servidor, quem registra é um interceptador, e não cada função lembrando de
   auditar (`docs/07`, Etapa 10).

### Documento clínico emitido

**Documento clínico emitido carrega o nome e o registro no conselho do autor.
Sem registro preenchido, não se emite.** O sistema não inventa a identificação
de quem assina, pela mesma razão da regra 4: não se preenche, no lugar do
profissional, aquilo que só ele pode responder. O registro se completa em
Perfil e preferências, pelo próprio dono — nunca pela administração.

### Vocabulário obrigatório
O professor **relata o que observou**; a **leitura clínica é do profissional
habilitado**. Ocorrência da escola entra como *evento comportamental preliminar*.
Nada de vocabulário interpretativo ou culpabilizante na área da escola.

## 4. Modelo de dados

22 classes. Diagrama completo em `docs/uml/`.

```
Usuario ◁── Profissional | Responsavel | ProfessorAEE      (herança: autenticação única)
Usuario 0..1─* RegistroAuditoria
Responsavel 1─* VinculoFamiliar *─1 Paciente               (parentesco é da relação)
Paciente 1─* Sessao        Sessao *─1 Profissional          ("conduzida por")
Paciente 1─* PlanoTerapeutico *─1 Profissional              ("autor")
Paciente *─1 Profissional     ("responsável pelo caso")
Paciente *─1..* Profissional  ("equipe")
PlanoTerapeutico ◆─* Objetivo        (composição: objetivo não existe sem plano)
Objetivo ◆─1 CriterioDominio
Objetivo 1─* AtividadeCasa | CartaoEstrategia
AtividadeCasa 1─* ExecucaoAtividadeCasa *─1 Responsavel
Sessao ◆─* RegistroAtividade *─1 Objetivo
Paciente 1─* OcorrenciaComportamental *─0..1 Sessao
RelatorioEvolucao *─1..* Objetivo   ("abrange")
Responsavel 1─* Consentimento *─1 Escola | 1─1 Paciente
Consentimento 1─1..* ConviteEscolar 1─0..1 VinculoEscolar 1─* OcorrenciaEscolar
VinculoEscolar *─1 ProfessorAEE
OcorrenciaEscolar ⇢ OcorrenciaComportamental   («gera»)
Perfil é enumeração, não classe.
```

A cadeia `Consentimento → ConviteEscolar → VinculoEscolar → OcorrenciaEscolar` é o
que torna a regra 2 difícil de burlar: sem consentimento não há convite, sem
convite aceito não há vínculo, sem vínculo não há ocorrência. **Não crie atalhos
que contornem essa cadeia.**

### O diagrama é modelo, não contrato de API

O diagrama de classes é modelo de domínio e de persistência, não contrato de API.
Chave estrangeira, campo calculado e recorte de resposta pertencem à camada de
serviços e **não entram no diagrama**.

Atributo de persistência que nunca trafega — `senhaHash` — **permanece no diagrama
e fica fora dos tipos do front-end**.

**O nome da operação na fachada de serviços pode diferir do nome no diagrama.** O
diagrama nomeia a operação de domínio; o serviço nomeia a chamada como ela se lê no
código. `CartaoEstrategia.iniciarDe(objetivo)` no diagrama é
`servicos.planos.iniciarCartao(objetivoId)` na fachada. Isso não é divergência — é a
mesma separação que mantém chave estrangeira fora do diagrama.

## 5. Stack

| Camada | Tecnologia | Situação |
|---|---|---|
| Front-end | React 18 + TypeScript + Vite + TailwindCSS | Em construção |
| Dados | Camada de serviços com implementação simulada | Ver `docs/01` seção 4 |
| Back-end | NestJS sobre Node.js 22 LTS | Em construção, `docs/07` |
| Banco | PostgreSQL + Prisma, hospedado no Neon | Em construção, `docs/07` |
| Hospedagem | Render, servindo front e API no mesmo endereço | Em construção, `docs/07` |

Qualidade: ISO/IEC 25010:2023. Método: Kanban com limites de trabalho em progresso.

## 6. Convenções

- **Identificadores em português sem acento**, seguindo o diagrama de classes:
  `descricaoTecnica`, `VinculoEscolar`. Comentários em português.
- **Nomes de classe exatamente como no diagrama.** `CartaoEstrategia`, não
  `CartaEstrategia`.
- Atributos na UML na forma `nome : Tipo`.
- Commits em português, imperativo, referenciando o caso de uso:
  `feat(UC15): consulta do cartao de estrategias`.
- **Nunca gravar dado pessoal real**, nem em desenvolvimento. Os dados de
  demonstração são fictícios e permanecem assim.
- Nenhum componente importa de `servicos/mock`. Importa sempre de `servicos`.

## 7. Estado atual

Atualizado em 13/10/2026, lendo o código — não a memória.

**Concluído**
- Pré-projeto entregue em 17/08 — não pode mais ser alterado
- Alinhamento aos 5 eixos · cronograma de 13 semanas · quadro Kanban
- Modelagem UML: casos de uso, classes (revisão de 11/10 em `docs/uml/`), sequência
- Documento de IHC e UX/UI com avaliação heurística e conformidade
- **As 22 telas existem e falam com a camada de serviços**, em 24 rotas do
  produto, mais `/sobre` e a vitrine `/dev/estados`, que só existe no servidor de
  desenvolvimento. Nenhuma tela lê dado fixo: `src/dados` foi removido, e o teste
  de arquitetura impede que volte. A tela 20, ajuda, é texto fixo por natureza
- **Camada de serviços**: `servicos/contratos.ts` com 16 serviços; implementação
  simulada que aplica controle de acesso e auditoria; stubs de API que não
  aplicam regra nenhuma; a escolha entre as duas por `VITE_API_URL`
- **177 testes em 10 arquivos.** O principal é
  `servicos/mock/regrasInviolaveis.test.ts`, que verifica as regras invioláveis
  na camada de dados, e não na tela
- **As seis regras verificadas** em `docs/06`: para cada teste citado, a regra foi
  quebrada de propósito para confirmar que ele falha, e as quebras que não
  derrubaram teste nenhum estão registradas
- Termo de consentimento versionado, com resumo verificável (abaixo)
- Publicação automática no GitHub Pages, com testes antes do build; em pull
  request, `verificar.yml` roda testes e build
- Uma tag por etapa fechada: `entrega-2026-09-14`, `etapa-6`, `etapa-7`, `etapa-8`

**Em construção — Etapa 9, a fundação do servidor (`docs/07`, até 19/10)**

O `docs/07` substitui as etapas 9 e 10 do `docs/05`. No código, hoje:
- Nada do servidor existe: não há `api/`, `compartilhado/` nem *workspaces*.
  Tipos, contratos e domínio continuam em `src/`
- Três restos da etapa 8 continuam abertos:
  - a negativa da escola não tem tipo próprio: o motivo viaja como texto em
    `ErroServico.campos.motivo`;
  - a tela 18, com acesso revogado, mostra o erro genérico com "Tentar de novo",
    e não a tela de acesso encerrado que o `docs/03` pede;
  - a confirmação de encerramento da tela 17 deixa o foco cair no `<body>`
- A regra 6 exige o registro de toda leitura e escrita de dado do paciente, e o
  mock registra só parte. Ele não vai ser ajustado: sai na Etapa 12, e no
  servidor o registro é do interceptador, na Etapa 10. O que falta cobrir está
  no achado 2 do `docs/06`

**Próximo, pelo `docs/07`**
- Etapa 10, até 26/10 — autenticação, *guards*, auditoria com *trigger* e os
  módulos do caminho crítico das regras
- Etapa 11, até 09/11 — os demais serviços
- Etapa 12, até 15/11 — a virada: o front só com a API, e `servicos/mock` removido
- Etapa 13, de 16/11 a 23/11 — artigo, slides, vídeo e ensaio
- Depois da Etapa 11, o offline reduzido ao registro de sessão (`docs/07`,
  seção 3A)

Duas decisões aguardam a orientadora, e as datas acima serão revistas quando ela
responder: a data final (23/11 ou 30/11) e a Trilha de Autonomia (`docs/08`).

As entregas de documentação do pré-projeto — matriz de rastreabilidade, BPMN, C4
e estados do Objetivo — não vivem neste repositório; o estado de cada uma está no
`docs/08`. DER e dicionário de dados saem do esquema Prisma, pelo Cowork, depois
do commit 4 da Etapa 9.

**Afirmações que o código ainda não sustenta**

Enquanto não se resolverem, não devem ser afirmadas na defesa:

1. **A meta 8.5 da ODS 8 não tem sustentação no modelo.** Ela depende de uma
   entidade de registro funcional que não existe em nenhuma das 22 classes. Ou a
   entidade entra no modelo, ou a justificativa é reescrita. A decisão está com a
   orientadora (`docs/08`, decisão 2).
2. **O sistema não funciona sem rede.** O registro de sessão offline está
   previsto (`docs/07`, seção 3A): manifesto e *service worker* para instalar
   como PWA, fila no IndexedDB e chave de idempotência gerada no aparelho. Até
   ser construído, não há manifesto nem *service worker*. O registro de sessão
   (tela 7) mostra o estado da conexão e marca como pendente o que ainda não
   subiu, mas a fila de sincronização não existe.

O hash do termo de consentimento saiu desta lista em 04/10/2026: `hashTermo`
passou a ser `sha256:<versão>:<hex>` calculado sobre os campos que compõem o
termo, e a família reabre o texto da versão registrada pela própria tela 17.

**Revisões do modelo**
- 20/09/2026 — `Perfil` deixou de ser classe e virou enumeração · `VinculoFamiliar`
  e `ConviteEscolar` criados · `atuacao` desceu de `ProfessorAEE` para
  `VinculoEscolar` · a família nomeia a escola no `Consentimento`; o professor
  declara turma, turno e atuação ao aceitar o convite
- 21/09/2026 — `Objetivo` ganhou `dominadoEm`; `OcorrenciaComportamental` trocou
  `preliminar` por `leituraClinicaEm`. As duas datas existem para o painel da
  coordenação poder contar quando cada transição aconteceu
- 26/09/2026 — `RelatorioEvolucao` criada, a 22ª classe. Relatório emitido é
  documento clínico: guarda o conteúdo como saiu e o hash dele, porque gerar de
  novo a partir dos dados de hoje produziria outro documento
- 11/10/2026 — `RegistroAuditoria` ganhou `valorAnterior : String`. Guarda o JSON
  canônico **apenas dos campos que mudaram**, na versão anterior — nunca o
  registro inteiro, por minimização. Hoje só a correção de ocorrência escolar o
  preenche; nas demais ações é nulo

**Termo de consentimento**

O texto do termo vive em `src/dominio/termo.ts`, versionado. **Versão antiga
nunca é removida:** um termo aceito há seis meses precisa poder ser
reapresentado com as palavras daquela época. O texto renderizado não é gravado —
ele se reproduz da versão mais os campos do `Consentimento`, e o resumo prova
que nenhum deles mudou. O diagrama de classes não muda por causa disso: a versão
viaja dentro do próprio `hashTermo`.

**Pendências conhecidas do modelo**
- Não existe entidade de registro funcional (ver a afirmação 1 acima)
- Trilha de Autonomia: movida para trabalhos futuros em setembro; a decisão
  voltou à orientadora (`docs/08`)

## 8. Divisão de trabalho entre as duas sessões de IA

| | Onde | O quê |
|---|---|---|
| **Cowork** | Aplicativo desktop, na nuvem | Documentação, diagramas, textos, decisões de projeto |
| **Claude Code** | Terminal, nesta pasta | Implementação, testes, git |

Documento novo, diagrama novo ou decisão de arquitetura: vai para o Cowork. Código:
vem para cá. Se durante a implementação aparecer uma contradição na documentação,
**não a resolva por conta própria** — registre e leve ao Cowork.
