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
| `docs/09-DICIONARIO-DE-DADOS.md` | Ao afirmar algo sobre o banco |
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
`servicos.planos.criarCartao(objetivoId, dados)` na fachada. Isso não é divergência — é a
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
- **Produção começa vazia** e se preenche pelo uso: nenhum registro é
  pré-carregado, e a semente não roda em produção. **Os testes usam dados
  fictícios próprios** — dado de teste não é dado do site. Na tela de entrada e
  no rodapé fica o aviso *"Ambiente acadêmico do TCC SINCTEA. Não cadastre dados
  de pacientes reais."* (`docs/07`, seção 0). Tirá-lo é decisão do Lucas com a
  orientadora
- Nenhum componente importa de `servicos/mock`. Importa sempre de `servicos`.

## 7. Estado atual

Atualizado em 18/10/2026, lendo o código — não a memória.

**Concluído**
- Pré-projeto entregue em 17/08 — não pode mais ser alterado
- Alinhamento aos 5 eixos · cronograma de 13 semanas · quadro Kanban
- Modelagem UML: casos de uso, classes (revisão de 18/10 em `docs/uml/`), sequência
- DER e dicionário de dados (`docs/uml/` e `docs/09`), gerados em 18/10 do
  catálogo do PostgreSQL com as seis migrações. Não se editam à mão: mudou o
  esquema, geram-se de novo
- Documento de IHC e UX/UI com avaliação heurística e conformidade
- **As 22 telas existem e falam com a camada de serviços**, em 24 rotas do
  produto, mais `/sobre` e a vitrine `/dev/estados`, que só existe no servidor de
  desenvolvimento. Nenhuma tela lê dado fixo: `src/dados` foi removido, e o teste
  de arquitetura impede que volte. A tela 20, ajuda, é texto fixo por natureza
- **Camada de serviços**: `compartilhado/src/contratos.ts` com 16 serviços; implementação
  simulada que aplica controle de acesso e auditoria; o cliente da API, que
  não aplica regra nenhuma. A versão publicada usa só a API, e o mock fica
  fora do pacote; no desenvolvimento, `VITE_API_URL` escolhe entre as duas
- **414 testes em 31 arquivos, nos três pacotes**, rodados por um único
  `npm test` na raiz, sem passo manual. O principal ainda é
  `src/servicos/mock/regrasInviolaveis.test.ts`, que verifica as regras
  invioláveis na camada de dados, e não na tela. Os 192 do servidor rodam contra
  um PostgreSQL 17 de verdade
- **As seis regras verificadas** em `docs/06`: para cada teste citado, a regra foi
  quebrada de propósito para confirmar que ele falha, e as quebras que não
  derrubaram teste nenhum estão registradas
- Termo de consentimento versionado, com resumo verificável (abaixo)
- Em push na main, o workflow Publicar (`deploy.yml`) testa contra o
  PostgreSQL 17, constrói a imagem Docker, põe a imagem para rodar e só então
  migra o banco, com o papel dono. Não publica mais no GitHub Pages. Em pull
  request, `verificar.yml` roda testes e build
- Uma tag por etapa fechada: `entrega-2026-09-14`, `etapa-6`, `etapa-7`, `etapa-8`,
  `etapa-9`

**Em construção — o caminho principal, até 19/10 (`docs/07`, seção 0)**

Em 16/10, a orientadora pediu o sistema real, **sem nenhum dado fictício no
site**, com front e backend prontos em 19/10. A seção 0 do `docs/07` vale sobre o
resto dele: o sistema nasce vazio, o caminho principal vem primeiro, e a semente
em produção (o antigo passo B5) foi cancelada. No código, hoje:
- Passos 1 a 4 e o 4b feitos: `docs/07` e `CLAUDE.md`; os restos da Etapa 8;
  *npm workspaces* com três pacotes — o front na raiz, `compartilhado/` com
  tipos, contratos e domínio, e `servidor/` com NestJS; o banco; e, no 4b, os
  caminhos coerentes e as datas civis
- O banco: `servidor/prisma/schema.prisma`, com Prisma 7.10.0 e o adaptador
  pg. São 22 tabelas: 21 das classes (`CriterioDominio`, objeto de valor, vira
  colunas de `objetivo`) e a de junção da equipe do paciente. A migração inicial traz
  os CHECKs da seção 7 do `docs/01` e os *triggers* que tornam imutáveis a
  auditoria e o relatório emitido. A semente porta os dados do mock, com senha
  em argon2id, tokens de convite aleatórios e dois relatórios emitidos. Ela serve
  só aos testes: em produção não roda
- A segunda migração, `caminhos_coerentes`, garante que dois caminhos entre
  as mesmas linhas levam ao mesmo paciente: cinco chaves estrangeiras compostas
  (vínculo escolar → consentimento e → convite, ocorrência escolar → vínculo,
  ocorrência comportamental → ocorrência escolar e → sessão) e *triggers* para o
  que chave composta não alcança — o objetivo da atividade de casa e do registro
  de sessão, os objetivos do relatório e o dono fixo de plano, objetivo e
  sessão. Composição sem cascata: apagar plano com objetivo é recusado. Entraram
  também os índices das chaves estrangeiras e dos filtros (`docs/06`, seção 7)
- A terceira, `chaves_compostas_sem_cascata`, tira a cascata da atualização das
  cinco chaves compostas: trocar o paciente de um consentimento com vínculo é
  recusado, em vez de levar o vínculo e as ocorrências junto
- **Datas civis** — nascimento, validade do consentimento, período do relatório,
  início e revisão do plano, dia da atividade de casa — são `DataCivil`,
  "AAAA-MM-DD", sem hora nem fuso, do banco à tela. A validade vale o dia
  inteiro e termina à 00:00 do dia seguinte em Manaus (`fimDaValidade`, em
  `compartilhado/src/dominio/datas.ts`), qualquer que seja o fuso da máquina:
  o teste roda com ela em UTC, em Tóquio e em Manaus
- `GET /api/saude` lê o banco: responde 200 com o nome da última migração
  aplicada, ou 503 com o banco fora do ar
- Na máquina de desenvolvimento, `npm run banco -w @sinctea/servidor` sobe um
  PostgreSQL 17 embutido em `servidor/.banco/`, porta 54329, sem instalação nem
  Docker. Nos testes, um embutido descartável; no CI, o serviço `postgres:17`
- O deploy (passo 5 da Etapa 9): o `Dockerfile` (Node 22 em Debian slim, só
  dependências de produção, sem o Prisma CLI); o Nest servindo o build do front
  na raiz quando `PASTA_DO_FRONT` aponta para ele, com a API em `/api` e 404 em
  JSON para o resto; e o papel `sinctea_app`, que não é dono de nada
  (`servidor/prisma/papel-aplicacao.exemplo.sql`). O Neon tem as seis
  migrações, aplicadas pelo job `migrar`; o `sinctea_app` foi conferido nele.
  O Render publica em https://sinctea.onrender.com
- Os três pacotes são ESM. O front compila o fonte do compartilhado pela
  condição `fonte` do `package.json`; o servidor importa o JavaScript de
  `compartilhado/dist`, que o build dele gera antes
- **Item 1 do caminho principal feito — autenticação de verdade.** Entrar,
  sair, sessão atual, trocar de perfil e primeiro acesso por link, na API e na
  tela (`/app/primeiro-acesso/:token`). Senha em argon2id; sessão no banco
  (`sessao_login`), 24 horas desde o último uso, cookie `httpOnly`, `Secure` e
  `SameSite=Lax`; link de 72 horas e uso único (`acesso_inicial`); dos dois
  tokens, o banco guarda só o resumo SHA-256. E-mail gravado em minúsculas, com
  CHECK. Limite de tentativas: 5 senhas erradas para o mesmo e-mail em 15
  minutos, ou 20 do mesmo IP, bloqueiam por 15 minutos; fica em memória, e
  reiniciar o servidor zera a contagem. As duas tabelas novas são
  infraestrutura, e não classes: o banco tem
  24 tabelas, e o diagrama continua com 22 classes
- **A regra 6 no servidor:** toda rota declara a auditoria (`@Auditar` ou
  `@SemDadoDoPaciente`) e a guarda recusa a que não declara; o interceptador
  grava o registro antes de a resposta sair, e o filtro de erros registra toda
  negativa. As rotas da clínica (item 3), da família e da escola (item 4) leem
  dado do paciente, cada uma com a sua declaração. O mock continua registrando
  só parte (achado 2 do `docs/06`)
- **Item 2 feito — usuários e profissionais.** A gestão de usuários (tela 14) e
  os dados profissionais (tela 21) falam com a API. A conta da equipe nasce com
  uma senha que ninguém conhece e um link de primeiro acesso, que a tela mostra
  para quem cadastrou entregar; "Gerar novo link de acesso" serve ao link
  vencido e à senha esquecida
- **Item 3 feito — pacientes, plano com cartão e sessão.** As telas 4 a 7 e a
  validação da coordenação falam com a API. Entraram o cadastro do responsável
  na ficha, com o link de primeiro acesso (lacuna 2), o "Criar plano" (lacuna 3)
  e o cartão de estratégias escrito pelo terapeuta, sempre com conteúdo
  (lacuna 5); `iniciarCartao` saiu. Encerrar a sessão atualiza o percentual e a
  situação do objetivo trabalhado — o mock nunca atualizava, e com o sistema
  vazio o medidor ficaria em zero. Os eventos comportamentais da ficha, a
  evolução, as atividades e o relatório ainda são do mock
- **Item 4 feito — família, escola, consentimento e convite.** As telas 2,
  15, 17, 18, 19 e 22 falam com a API. Só o responsável legal concede e
  reemite o convite; qualquer responsável vinculado encerra, e a leitura
  seguinte da escola já é negada. O convite guarda só o resumo SHA-256 do token
  (migração `convite_token_resumo`). A família cadastra a escola que não está
  na lista, depois de ver as parecidas do mesmo município (lacuna 4). O
  professor de mais de um aluno aceita o convite novo com o e-mail e a senha
  da conta que já tem, e a senha errada conta no limite de tentativas. As
  regras 1, 2, 3, 5 e 6 estão provadas contra a API em
  `servidor/test/escola.test.ts`, com as quebras no `docs/06`. A ocorrência da
  escola entra como evento preliminar, mas a clínica só a lê depois de 19/10
  (avisos da escola); a tela 19 diz "guardado", e não "avisada"
- **Item 5 feito — o front publicado só com a API.** No build de produção,
  `servicos/index.ts` usa só a API, no `/api` do mesmo endereço, e o plugin
  `semMockNoPacote` do `vite.config.ts` deixa o mock fora do pacote. As telas
  fora do caminho principal — agenda, indicadores, auditoria, evolução,
  atividades de casa e relatório — saem das rotas e do menu (`src/app/caminhoPrincipal.ts`); a coordenação entra na
  fila de planos.
  Saíram também `entrarDemonstracao` da API, o bloco de demonstração da
  entrada e `/dev/estados`. O aviso do ambiente está na entrada e no rodapé.
  O servidor manda `nosniff`, `no-referrer` e `X-Frame-Options: DENY` em toda
  resposta. `src/publicacao.test.ts` confere o próprio pacote de produção. No
  desenvolvimento sem `VITE_API_URL` e nos testes, o mock e as telas
  continuam
- **Item 6 feito — o relato da escola chega à clínica** (decisão do Cowork em
  16/10). Os avisos da escola no painel do terapeuta (tela 3, sem a agenda),
  os eventos comportamentais na ficha (tela 5) e a leitura clínica falam com a
  API. Só a equipe do paciente e a coordenação alcançam o evento; a leitura
  clínica é gravada uma vez, com trava na própria gravação; a lista de avisos,
  os eventos, a leitura e a negativa entram na trilha. O aviso vale por sete
  dias e sai da lista com a leitura; o evento continua na ficha. Encerrado o
  acesso da escola, o que ela relatou continua na clínica. Testes em
  `servidor/test/ocorrencias.test.ts`, quebras no `docs/06`
- **Item 7, parte 1 — a evolução da sessão** (Resolução CFP 001/2009). Encerrar
  exige a evolução, escrita pelo profissional e gravada como veio; o CHECK
  `sessao_evolucao_so_encerrada` (migração `evolucao_da_sessao`, `NOT VALID`
  para as sessões do primeiro ensaio) a quer preenchida se e só se a sessão
  está encerrada. Ela aparece no histórico de sessões da ficha, só para a
  equipe e a coordenação, e a trilha registra que foi escrita, sem o texto. O
  registro ABC na sessão voltou à versão publicada. Testes em
  `servidor/test/sessao.test.ts`
- **Item 7, parte 2 — navegação e edição.** Toda tela do app tem a trilha
  com links de volta (Pacientes › nome do paciente › Plano), e o Voltar do
  navegador funciona. Depois de salvar, a tela fica onde estava: a recarga não
  volta ao "carregando". Com o plano em `RASCUNHO` ou `DEVOLVIDO`, editam-se o
  objetivo (as duas redações e o critério) e as datas, com `ALTERACAO` e o
  `valorAnterior` só do que mudou. Testes em `servidor/test/edicao-plano.test.ts`
- **Item 7, parte 3 — duas contas no mesmo navegador.** Um 401 ou 403 fora
  da autenticação faz o front reler a sessão (`aoNegarAcesso`, em
  `src/servicos/api/cliente.ts`); se outra janela trocou a conta ou o perfil,
  ou saiu, um aviso por cima da tela diz isso e pede para recarregar
  (`src/app/AvisoDeJanela.tsx`). Testes em `src/contexto/mudancaDaSessao.test.ts`
- **Item 7, parte 4 — especialidade no lugar de "terapeuta".** Nenhuma tela
  diz a palavra: o perfil aparece como "Profissional da clínica", a pessoa
  como "Ana Souza · Psicologia" (`comEspecialidade` e `papelNaTela`, em
  `src/app/perfis.ts`), e o texto genérico diz "profissional". A sessão, a
  lista de pacientes e a fila de planos trazem a especialidade; convidar
  profissional da clínica a exige. O enum `TERAPEUTA` continua no código e no
  banco. `src/publicacao.test.ts` confere que o pacote não tem a palavra
- **Item 8, parte 1 — editar o responsável na rede de apoio.** A equipe do
  paciente e a coordenação corrigem nome, telefone e parentesco a qualquer
  momento; o e-mail, só enquanto o primeiro acesso está pendente, porque
  depois ele é o login da pessoa — conferido antes e na própria gravação. O
  e-mail fica em minúsculas e único, e o de uma conta da equipe ou da escola é
  recusado. `ALTERACAO` com o `valorAnterior` só do que mudou. Quem responde
  legalmente não se edita (afirmação 4, abaixo). Testes em
  `servidor/test/responsavel.test.ts`
- `npm run criar-administrador -w @sinctea/servidor -- .env.producao --nome
  "Nome Completo" --email voce@exemplo.com` cria o primeiro administrador:
  nome e e-mail vêm da linha de comando, e só a senha é pedida, escondida e duas
  vezes. Da leitura do teclado, só caractere imprimível entra; o `\n` que o
  Windows manda depois do `\r` é pulado (`servidor/src/comandos/terminal.ts`).
  O build fica no script `pre`: com `npm run build && node`, o npm escapava os
  argumentos para dois passes do `cmd.exe`, e o nome com espaço chegava com `^`.
  Recusa se já houver administrador
- Depois do ensaio, o banco volta a ficar vazio:
  `npm run zerar-banco -w @sinctea/servidor -- .env.dono`, com a URL direta do
  dono num arquivo fora do git, apaga o esquema, aplica as migrações sem semente
  e devolve ao `sinctea_app` os privilégios do modelo, sem recriar o papel. Pede
  que se digite o nome do banco. `npm run conferir-papel -w @sinctea/servidor --
  .env.producao` é a conferência do B3, só leitura, como o `sinctea_app`. Os dois
  estão provados em `servidor/test/zerar.test.ts`; o zerar ainda não rodou no Neon

**Próximo, pela seção 0 do `docs/07`**

Até 19/10, nesta ordem, um commit por item, enviado à main — o CI testa, migra e
o Render publica. Cada item leva o módulo do servidor (*guards*, mapeador para os
tipos do compartilhado, auditoria pelo interceptador), o cliente em
`src/servicos/api`, a tela ligada e os testes de integração das regras que toca:
1. ~~Autenticação de verdade (D5): entrar, sair, sessão atual e primeiro acesso
   por link; os *guards* (D7), o interceptador de auditoria e o comando do
   primeiro administrador~~ — feito em 16/10
2. ~~Usuários e profissionais; meus dados profissionais~~ — feito em 16/10
3. ~~Pacientes, com o cadastro do responsável; plano, do "Criar plano" ao cartão
   de estratégias; sessão~~ — feito em 16/10
4. ~~Família, escolas (com cadastro pelo responsável), consentimento, convite e
   a área da escola~~ — feito em 16/10
5. ~~O front publicado só com a API: o mock fora do pacote, as telas fora do
   caminho principal fora da navegação e das rotas, e sem `entrarDemonstracao`,
   avisos de demonstração nem `/dev/estados`~~ — feito em 16/10
6. ~~Avisos da escola na clínica, eventos comportamentais na ficha e a
   leitura clínica, para fechar o ciclo clínica–escola~~ — feito em 17/10

Não se corta, nem com pressa: as regras 1, 2, 3, 5 e 6 provadas por teste contra
a API no caminho principal, o *trigger* da auditoria, o papel que não é dono e o
argon2id.

Depois de 19/10, sem data: indicadores, relatórios, atividades de casa, a
evolução por objetivo (tela 8), a tela de auditoria e a agenda; o
envio de e-mail, com a recuperação de senha de responsável e professor; a remoção completa de `servicos/mock`; o offline reduzido ao registro de
sessão (`docs/07`, seção 3A); e a Etapa 13, de 16/11 a 23/11 — artigo, slides,
vídeo e ensaio.

Duas decisões aguardam a orientadora, e as datas acima serão revistas quando ela
responder: a data final (23/11 ou 30/11) e a Trilha de Autonomia (`docs/08`).

As entregas de documentação do pré-projeto — matriz de rastreabilidade, BPMN, C4
e estados do Objetivo — não vivem neste repositório; o estado de cada uma está no
`docs/08`.

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
3. **Responsável e professor não recuperam a senha.** Sem envio de e-mail, só
   a equipe recebe link novo, pela administração. A clínica não troca a senha
   de quem autoriza a escola. Limite declarado em 16/10: fica assim até o envio
   de e-mail, depois de 19/10.
4. **Quem responde legalmente não se corrige.** Na edição do responsável
   (item 8), o `responsavelLegal` do vínculo não se edita: a resposta dada no
   cadastro fica como está, e não há, no sistema, como corrigi-la. Limite
   declarado em 18/10.

O endereço do Render saiu desta lista em 17/10/2026: o B6 conferiu no ar `/`,
`/api/saude` com a última migração e o 404 em JSON (tag `etapa-9`). O
Auto-Deploy do Render está em *After CI Checks Pass*, conferido no painel em 18/10.

O cartão de estratégias saiu desta lista em 16/10/2026: o terapeuta o escreve
na tela 6, com conteúdo, e não existe mais cartão em branco.

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
  registro inteiro, por minimização. Hoje o preenchem a correção de ocorrência
  escolar, a edição de objetivo e das datas do plano e a do responsável; nas
  demais ações é nulo
- 15/10/2026 — o diagrama alcançou o banco: `RegistroAuditoria` mostra
  `pacienteId : UUID [0..1]`, que é fotografia, sem chave estrangeira;
  `RelatorioEvolucao` ganhou `destinatario : Destinatario`, e `conteudoEmitido`
  passou de `Blob` a `String`, o JSON canônico que o hash resume
- 18/10/2026 — `Sessao` ganhou `evolucao : String [0..1]`: o registro
  documental da sessão (Resolução CFP 001/2009), escrito pelo profissional ao
  encerrar, nunca gerado. Preenchida se, e só se, a sessão está encerrada

**Termo de consentimento**

O texto do termo vive em `compartilhado/src/dominio/termo.ts`, versionado. **Versão antiga
nunca é removida:** um termo aceito há seis meses precisa poder ser
reapresentado com as palavras daquela época. O texto renderizado não é gravado —
ele se reproduz da versão mais os campos do `Consentimento`, e o resumo prova
que nenhum deles mudou. O diagrama de classes não muda por causa disso: a versão
viaja dentro do próprio `hashTermo`.

**Pendências conhecidas do modelo**
- Não existe entidade de registro funcional (ver a afirmação 1 acima)
- Trilha de Autonomia: movida para trabalhos futuros em setembro; a decisão
  voltou à orientadora (`docs/08`)
- `usuario.email` é único com diferença de maiúsculas: `Ana@x` e `ana@x` seriam
  duas contas. Na Etapa 10, o login normaliza para minúsculas, e a unicidade
  passa a valer sobre `lower(email)`
- `percentualMinimo`: o domínio aceita de 1 a 100 (`validarNovoObjetivo`), mas o
  CHECK do banco aceita de 0 a 100. Alinhar numa migração
- `frequenciaSemanal`, `sessoesConsecutivas`, `numero` e `ordem` não têm CHECK
  de no mínimo 1
- O `sinctea_app` só precisa ler `_prisma_migrations`: revogar o INSERT, o
  UPDATE e o DELETE dele nessa tabela

## 8. Divisão de trabalho entre as duas sessões de IA

| | Onde | O quê |
|---|---|---|
| **Cowork** | Aplicativo desktop, na nuvem | Documentação, diagramas, textos, decisões de projeto |
| **Claude Code** | Terminal, nesta pasta | Implementação, testes, git |

Documento novo, diagrama novo ou decisão de arquitetura: vai para o Cowork. Código:
vem para cá. Se durante a implementação aparecer uma contradição na documentação,
**não a resolva por conta própria** — registre e leve ao Cowork.
