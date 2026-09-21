# 03 · Especificação das telas do sistema

21 telas. Cada uma implementa casos de uso já especificados na modelagem UML.

Legenda de situação: **✓ existe** (já construída) · **↻ refazer** (existe mas muda)
· **✗ nova**.

---

## Perfis e o que cada um alcança

| Perfil | Telas |
|---|---|
| Terapeuta | 3 a 10, 20, 21 |
| Coordenador Clínico | 3 a 13, 20, 21 |
| Administrador | 14, 20, 21 |
| Responsável | 15 a 17, 20, 21 |
| Professor / AEE | 2, 18, 19, 20, 21 |

Um usuário pode ter mais de um perfil. A troca acontece em `/app/conta`.

---

# Acesso

## 1 · Entrar ✗
`/app/entrar` · Todos os perfis

Autenticação. No diagrama de casos de uso, "Autenticar-se" foi tratado como
requisito transversal e está representado pela operação `Usuario.autenticar()`.

**Conteúdo:** identidade do produto · campos e-mail e senha · "Entrar" · link
"Esqueci minha senha" · link de volta para o site.

**Bloco de demonstração**, separado por uma linha e um rótulo claro: quatro botões
que entram direto como Terapeuta, Coordenador, Responsável ou Professor. É o que
permite mostrar o sistema em aula sem cadastro.

**Regras:** erro de credencial nunca revela se o e-mail existe — mensagem única
"E-mail ou senha incorretos". Sem CAPTCHA (e-MAG 6.8; WCAG 3.3.8). Sem limite de
tempo de sessão que expire sem aviso.

**Aceitação:** operável só por teclado · erro anunciado em região dinâmica · os
quatro botões de demonstração levam a painéis diferentes.

## 2 · Aceitar convite ✗
`/app/convite/:token` · Professor / AEE

O professor chega por um link de uso único entregue pela família. Este é o único
caminho de entrada da escola — **não existe autocadastro de professor**.

**Conteúdo:** quem convidou e para qual aluno · o que ele poderá ver, e o que não
poderá · validade do acesso · campos nome, e-mail e senha · "Criar minha conta".

**Estados:** token válido · token já usado · token expirado (72 h) · consentimento
revogado antes do aceite. Cada um com texto próprio, explicando o que fazer.

**Aceitação:** a lista do que ele **não** verá aparece antes do formulário, não
depois.

---

# Área clínica — Terapeuta

## 3 · Painel do terapeuta ✓ ↻
`/app/clinica` · UC10, UC04, UC06

Já existe. Muda: agenda vem de serviço paginado, e o aviso da escola vira lista
(pode haver mais de um).

**Conteúdo:** saudação com data · avisos de ocorrência escolar · agenda do dia com
estado por atendimento · registros aguardando sincronização · atalhos.

Os avisos da escola são só os eventos ainda preliminares: é a fila do que espera a
leitura clínica do profissional. Registrada a leitura, o aviso sai da lista — o
histórico fica na ficha.

**Aceitação:** zero atendimentos hoje mostra estado vazio com texto próprio, não
uma lista em branco.

## 4 · Lista de pacientes ✗
`/app/clinica/pacientes` · UC01

**A tela que falta para o sistema parecer um sistema.** Hoje existe um paciente
fixo no código.

**Conteúdo:** busca por nome · filtros por profissional responsável, nível de
suporte e situação do plano · tabela com nome, idade, nível de suporte,
profissional, situação do plano e data da última sessão · paginação · botão
"Cadastrar paciente".

**Regras:** o terapeuta vê apenas os pacientes que acompanha. O coordenador vê
todos da clínica. Essa diferença é visível no rótulo acima da tabela.

**Aceitação:** busca sem resultado mostra estado vazio que oferece limpar o filtro
· a tabela tem `caption` e `th scope` · rola horizontalmente em recipiente próprio,
sem empurrar a página.

## 5 · Ficha do paciente ✗
`/app/clinica/pacientes/:id` · UC01

**Conteúdo:** identificação e nível de suporte · rede de apoio (responsáveis com
parentesco e quem é o responsável legal) · equipe multiprofissional com
especialidade · vínculo escolar, se houver, com situação do consentimento ·
eventos comportamentais recentes dos últimos 30 dias, de todas as origens, com a
situação da leitura clínica · histórico resumido · ações para plano, sessão e
evolução.

**Regras:** nível de suporte 1, 2 ou 3 conforme DSM-5-TR, sempre com a descrição
por extenso ao lado do número. Ninguém deve precisar decorar o que significa "2".

## 6 · Plano Terapêutico Individual ✓ ↻
`/app/clinica/pacientes/:id/plano` · UC02, UC03

Já existe. Muda: vira editável e ganha o formulário de objetivo.

**Conteúdo:** datas de início e revisão · situação do plano · objetivos agrupados
por domínio, cada um com as duas redações, percentual e critério · alternância
entre redação técnica e acessível · "Adicionar objetivo".

**Formulário de objetivo:** domínio · descrição técnica · **descrição acessível** ·
critério (percentual mínimo e sessões consecutivas).

**Regra inviolável:** a descrição acessível é campo obrigatório, escrito pelo
terapeuta. **Não ofereça botão de gerar automaticamente a partir da técnica.** Quem
responde pelo conteúdo é o profissional.

**Aceitação:** tentar salvar sem a descrição acessível produz erro que explica por
que o campo existe, não apenas "campo obrigatório".

## 7 · Registro de sessão ✓ ↻
`/app/clinica/pacientes/:id/sessao` · UC04, UC05, UC06

Já existe, com desfazer. Muda: seleção do objetivo e registro ABC de verdade.

**Conteúdo:** objetivo em trabalho, trocável · quatro botões de resposta ·
contadores · desfazer o último registro · registro de ocorrência comportamental
com antecedente, comportamento, consequência, intensidade · encerrar ou pausar.

**Regras:** o estado de conexão fica sempre visível. Nada se perde sem conexão. A
sessão precisa do profissional que a conduziu — associação `Sessao 0..* — 1
Profissional`.

**Aceitação:** desfazer devolve o contador ao valor anterior · trocar de objetivo
não perde os registros do anterior.

## 8 · Evolução por objetivo ✓ ↻
`/app/clinica/pacientes/:id/evolucao` · UC08

Já existe. Muda: seletor de objetivo e a comparação entre contextos.

**Conteúdo:** seletor de objetivo · gráfico de linha por sessão com a referência do
critério · alternativa em tabela · situação da promoção a dominado · **comparação
entre os três contextos** (clínica, casa, escola).

**Cuidado com a comparação entre contextos.** As três medidas têm naturezas
diferentes: percentual de tentativas na clínica, escolha em três opções em casa,
intensidade de 1 a 5 na escola. **Não as coloque na mesma escala nem calcule média
entre elas** — seria inválido do ponto de vista psicométrico e a banca pode cobrar.

Apresente como três faixas paralelas de tendência, cada uma com sua própria escala
rotulada, alinhadas na mesma linha do tempo. A leitura que interessa é "sobe junto
ou diverge", não "qual é maior".

**Regra de suficiência:** só exiba a comparação com no mínimo cinco registros e
três semanas em cada contexto. Abaixo disso, mostre "dados insuficientes para
comparar" e diga o que falta.

## 9 · Prescrever atividade para casa ✗
`/app/clinica/pacientes/:id/atividades` · UC07

**Conteúdo:** atividades ativas com frequência e adesão · "Prescrever nova" ·
formulário com título, descrição, passos, frequência semanal, vídeo e objetivo
vinculado · histórico de execuções registradas pela família.

**Regras:** escrita em linguagem cotidiana — a família é quem lê. Toda atividade se
vincula a um objetivo do plano; atividade solta não existe.

## 10 · Emitir relatório de evolução ✗
`/app/clinica/pacientes/:id/relatorio` · UC09

**Conteúdo:** seleção de período e de objetivos · pré-visualização · botão de
gerar · histórico de relatórios emitidos.

**Regras:** relatório é documento clínico — Terapeuta e Coordenador apenas. A
escola **nunca** acessa esta tela. Toda emissão entra na trilha de auditoria.

---

# Área clínica — Coordenação

## 11 · Painel de indicadores da clínica ✗
`/app/coordenacao` · UC18

**É a "dashboard da clínica"** no sentido de gestão — diferente do painel do
terapeuta, que é a visão de quem atende.

**Conteúdo, nesta ordem de leitura:**

1. Quatro números no topo: pacientes em acompanhamento · sessões na semana ·
   objetivos dominados no mês · planos vencendo em 30 dias
2. O que precisa de atenção: planos sem revisão há mais de 90 dias · pacientes sem
   sessão há mais de 15 dias · consentimentos escolares vencendo em 30 dias ·
   objetivos parados há mais de 8 sessões
3. Distribuição de sessões por profissional
4. Ponte clínica–escola: escolas com vínculo ativo, ocorrências no mês, tempo médio
   entre a ocorrência e o retorno do terapeuta

**O bloco 2 é o coração da tela.** Um painel que só mostra números bonitos não serve
para nada. O que faz alguém abrir todo dia é a lista do que exige ação — e cada
item dessa lista leva direto ao paciente correspondente.

**Regras:** indicadores agregados não expõem conteúdo clínico. Contam e apontam,
não descrevem.

**Aceitação:** cada alerta é clicável e leva ao registro · clínica recém-criada
mostra estado vazio explicando que os indicadores aparecem após as primeiras
sessões · nenhum número aparece sem rótulo de período.

## 12 · Validar planos terapêuticos ✗
`/app/coordenacao/planos` · UC17

**Conteúdo:** fila de planos aguardando validação, com paciente, autor e data ·
visualização do plano · aprovar ou devolver com observação · histórico.

**Regras:** devolver exige observação escrita. Devolução sem justificativa não
ensina nada a quem recebeu.

## 13 · Registro de auditoria ✗
`/app/coordenacao/auditoria` · UC19

**É o que prova a conformidade com a LGPD.** Se a banca perguntar como vocês
garantem o artigo 37, esta é a resposta.

**Conteúdo:** filtros por período, usuário, ação e paciente · tabela com data e
hora, usuário, perfil, ação, entidade e origem · exportação.

**Registra três momentos:** concessão de acesso · leitura autorizada de dado
sensível · **tentativa de acesso negada**.

**Regras:** registro de auditoria é imutável. Nenhuma tela oferece editar ou
excluir. Registrar o acesso que não ocorreu é tão relevante quanto registrar o que
ocorreu.

---

# Administração

## 14 · Gerenciar usuários e perfis ✗
`/app/admin/usuarios` · UC20

**Conteúdo:** lista com nome, e-mail, perfis, situação e último acesso · convidar
usuário · editar perfis · desativar.

**Regras:** desativar, nunca excluir — o histórico clínico precisa manter a autoria.
Um administrador não pode desativar a si mesmo.

---

# Área da família

## 15 · Painel da família ✓ ↻
`/app/familia` · UC13

Já existe. Muda: suporta mais de um filho em acompanhamento.

**Conteúdo:** evolução em linguagem cotidiana · atividades da semana · situação do
acesso da escola.

**Regras:** **nenhum termo clínico nesta área.** Só a redação acessível dos
objetivos. Sem percentual cru sem explicação: "6 ou 7 de cada 10 vezes" comunica;
"65%" não.

## 16 · Atividade em casa ✓
`/app/familia/atividades/:id` · UC14

Já existe e está adequada.

## 17 · Autorizar acesso da escola ✓
`/app/familia/consentimento` · UC11, UC12, UC21

Já existe, com confirmação em duas etapas para encerrar.

**Regras que o código precisa honrar:** quem autoriza é o responsável · escopo e
validade explícitos · convite de uso único com 72 h · revogação com efeito imediato
e sem cache que sobreviva a ela · a lista do que a escola nunca verá aparece junto
da autorização.

---

# Área da escola

## 18 · Cartão de estratégias ✓
`/app/escola/:pacienteId` · UC15, UC21

Já existe.

**Regras:** a verificação de consentimento acontece antes de qualquer leitura.
Consentimento revogado ou expirado mostra a tela de acesso encerrado, não uma tela
vazia. A consulta entra na auditoria.

## 19 · Registrar ocorrência ✓
`/app/escola/:pacienteId/ocorrencia` · UC16

Já existe, com validação que nomeia o que falta.

**Falta implementar:** a janela de 30 minutos para correção, prometida no texto de
confirmação. Editar mantém a versão original na trilha de auditoria.

---

# Transversal

## 20 · Central de acessibilidade e ajuda ✓
`/app/ajuda`

Já existe. Muda: ganha as perguntas frequentes por perfil.

## 21 · Perfil e preferências ✗
`/app/conta`

**Conteúdo:** dados da conta · troca de perfil ativo, quando houver mais de um ·
preferências sensoriais persistidas · sair.

## 22 · Meus alunos ✗
`/app/escola` · Professor / AEE · UC15 · UC21

Destino de entrada do professor. Sem ela, quem entra pelo perfil escolar não tem
para onde ir.

**Conteúdo:** os alunos para os quais este professor recebeu autorização, com nome,
turma e situação do acesso. Cada linha ativa leva ao cartão de estratégias.

**Regras de visibilidade:**

- Aparece o aluno cuja família já concedeu acesso a este professor, em algum
  momento.
- Consentimento vigente: linha ativa, leva ao cartão.
- Consentimento revogado ou expirado: a linha permanece, marcada como "Acesso
  encerrado pela família", sem caminho de entrada.
- Aluno que nunca concedeu não aparece, em hipótese alguma.

Manter a linha revogada não vaza informação: o professor já sabia que aquele aluno
está na sua turma e já tivera acesso. Sumir sem explicação o faria supor defeito no
sistema — e o passo 27 do diagrama de sequência determina que ele seja informado do
encerramento.

**Aceitação:** professor sem nenhuma autorização vê estado vazio explicando que o
acesso depende da família · a consulta à lista entra na trilha de auditoria.

---

## Ordem sugerida de construção

Cada bloco depende do anterior.

| Etapa | Telas | Por quê |
|---|---|---|
| 1 | 1, 21 e camada de dados | Sem sessão e sem serviços, nada mais se sustenta |
| 2 | 4, 5 | Lista de pacientes destrava tudo da clínica |
| 3 | 3, 6, 7, 8 refeitas | Passam a consumir serviços |
| 4 | 11 | O painel da clínica é o que muda a percepção do sistema |
| 5 | 9, 10, 12, 13, 14 | Completam clínica e coordenação |
| 6 | 2, 15, 17 ajustes | Fecham a ponte com a escola |
