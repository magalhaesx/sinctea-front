# 06 · Verificação das seis regras invioláveis

Lido no código em 12/10/2026 — não na memória, nem nos outros documentos.
Atualizado no mesmo dia, com a correção do achado 1 e as novas redações das
regras 1 e 2 no CLAUDE.md. Revisto em 13/10/2026: a regra 6 voltou a exigir o
registro de toda leitura e escrita de dado do paciente (achado 2). Na Etapa 9,
tipos, contratos e domínio foram para `compartilhado/src/`, e os caminhos e
números de linha foram refeitos para essa versão. Em 14/10/2026 entrou a seção 7,
sobre o servidor.

---

## 1. Três maneiras de uma regra estar garantida

Elas não valem o mesmo, e o documento existe para não confundi-las.

1. **Provada por teste.** Existe asserção que falha se a regra for violada. É a
   mais forte: quem quebrar a regra amanhã descobre na mesma hora.
2. **Garantida por construção.** Não existe caminho de código que faça o
   contrário. Mais fraca: nada impede que alguém acrescente esse caminho amanhã,
   e nenhum teste vai acusar.
3. **Convenção de front-end.** Depende de o cliente se comportar. Só vira
   garantia quando o servidor existir e aplicar a mesma regra.

**Como "falha se for violada" foi conferido.** Para cada teste citado na
terceira coluna, a regra foi quebrada de propósito no código, a suíte inteira
rodou, e a quebra foi desfeita. O teste só aparece na tabela se
falhou. As quebras e o que cada uma derrubou estão na seção 4. Quando uma
quebra **não** derrubou teste nenhum, isso está na quarta coluna — é o caso
mais importante do documento.

---

## 2. A tabela

Toda regra é aplicada na camada de serviços (`src/servicos/mock`) ou no módulo
de domínio que ela chama (`compartilhado/src/dominio/regras.ts`). **Nenhuma das seis está
aplicada só na interface.** A única afirmação que existia só na interface — a de
que apenas o responsável legal autoriza a escola — passou a valer no serviço
(achado 1).

| Regra | Onde é aplicada (arquivo e função) | Teste que falha se for violada | O que esse teste não prova |
|---|---|---|---|
| **1 · Quem autoriza a escola é o Responsável legal; convite de uso único, 72 h; sem autocadastro** | `consentimentosMock.conceder` (`mock/familia.ts:248`): `exigirPerfil(['RESPONSAVEL'])`, `exigirPacienteDaFamilia` e `exigirResponsavelLegal` (`mock/acesso.ts:52`) antes de tudo. `reemitirConvite` (`:306`) exige o mesmo; `revogar` (`:330`) não exige, de propósito.<br>`convitesMock.aceitar` (`mock/familia.ts:390`): `situacaoConvite` antes de criar a conta; `usadoEm` gravado no aceite (`:430`).<br>`calcularExpiracaoConvite` e `VALIDADE_CONVITE_HORAS` (`compartilhado/src/dominio/regras.ts:285`, `:19`).<br>`usuariosMock.convidar` (`mock/gestao.ts:114`): só `PERFIS_DE_EQUIPE` (`:91`). | *professor nao concede consentimento* · *terapeuta tambem nao concede*<br>*responsavel concede e recebe convite de uso unico com 72 horas* · *expira 72 horas depois de criado*<br>*os quatro estados do convite*<br>*o administrador nao cria professor nem responsavel por esta tela*<br>*responsavel nao legal recebe ACESSO_NEGADO ao conceder, e a negativa fica na auditoria* · *responsavel legal do mesmo paciente concede normalmente* · *gerar convite novo tambem amplia o acesso, e tambem exige a autoridade legal* · *responsavel nao legal consegue revogar um consentimento vigente do mesmo paciente* | **"Não existe autocadastro" é construção, não teste.** Nenhuma operação além de `convites.aceitar` cria `ProfessorAEE`; uma operação nova que criasse não seria acusada.<br>Coordenador e administrador não são testados em `conceder`: ficam de fora pela mesma lista de perfis, por construção.<br>A tela 17 esconder o formulário de quem não é responsável legal é conveniência: quem garante é o serviço. |
| **2 · Nenhum dado atravessa sem consentimento vigente e escopo, verificados a cada leitura** | `exigirAcessoEscola` (`mock/escola.ts:50`), primeira linha de `obterCartao`, `registrarOcorrencia` e `corrigirOcorrencia`.<br>Regra pura: `verificarAcessoEscola` (`compartilhado/src/dominio/regras.ts:251`) sobre `situacaoConsentimento` (`:224`).<br>Roda dentro de `responder` (`mock/infra.ts:39`), depois da latência: o consentimento é relido na hora da resposta. | *verificarAcessoEscola (UC21)* — os cinco casos, um por motivo<br>*escopo so de cartao nao permite registrar ocorrencia*<br>*a leitura seguinte a revogacao ja e negada e auditada* · *revogacao feita durante a latencia de uma leitura ja vale para ela* | **A regra é aplicada por chamada, não por estrutura.** Uma operação nova da escola que esqueça `exigirAcessoEscola` não é acusada. Tirar a verificação de `obterCartao` só foi pego pelos testes da regra 5, não pelos da regra 2.<br>No serviço não há teste de `SEM_CONSENTIMENTO` (professor pedindo o cartão de aluno sem vínculo), nem de `EXPIRADO` ou `AGUARDANDO_INICIO`. Esses motivos estão provados só na função pura.<br>`listarAlunos` não passa pela verificação, de propósito. Ver achado 3. |
| **3 · A escola nunca acessa evolução, plano, diagnóstico, laudo ou histórico de sessões** | Tipo `CartaoEscola` (`compartilhado/src/tipos.ts:739`) e projeção campo a campo em `obterCartao` (`mock/escola.ts:136`).<br>Contrato `ServicoAreaEscola` (`compartilhado/src/contratos.ts:141`): quatro operações, nenhuma clínica.<br>Nos demais serviços, `alcancaClinicamente` (`mock/acesso.ts:11`) devolve `false` para `PROFESSOR`, e as listas de `exigirPerfil` não o incluem. | *o cartao nao carrega nenhum campo clinico*<br>*professor nao alcanca nenhum servico clinico, e a tentativa e auditada*<br>*a escola nunca alcanca o relatorio, e a tentativa fica auditada*<br>*so quem alcanca o paciente confirma dominio ou registra leitura* | **O teste do cartão é uma lista de proibidos** (oito termos). Um campo clínico novo com outro nome — `hipotese`, `cid` — passaria.<br>**O tipo protege menos do que parece:** o compilador recusa `nivelSuporte` escrito direto no objeto (TS2353), mas aceita o mesmo campo vindo por *spread*. Conferido com `tsc`.<br>Nos testes, o professor só chama três serviços clínicos, o relatório, `confirmarDominio`, `registrarLeituraClinica` e o painel da coordenação. Os outros ficam fechados por construção, pelos mesmos `exigirPacienteClinico` e `exigirPerfil`. |
| **4 · Duas redações; a acessível é escrita pelo terapeuta, nunca gerada** | `validarNovoObjetivo` (`compartilhado/src/dominio/regras.ts:138`) recusa a acessível vazia.<br>`planosMock.adicionarObjetivo` (`mock/clinica.ts:57`) grava `dados.descricaoAcessivel.trim()`. É a única escrita do campo no código.<br>Projeções: `familia.listarObjetivos` (`mock/familia.ts:142`), `obterCartao` (`paraQue`), relatório por destinatário. | *objetivo sem descricao acessivel e recusado* · *recusa descricao acessivel vazia explicando por que o campo existe*<br>*a descricao acessivel e gravada como foi escrita*<br>*a familia recebe so a redacao acessivel* | **Os dois testes da regra provam a metade positiva:** a redação acessível é obrigatória na entrada e gravada como chegou. **Nenhum prova a metade negativa, "nunca gerada automaticamente".**<br>Um botão na tela 6 que preenchesse o campo a partir da redação técnica passou pelos 173 testes. O serviço recebe uma *string* e não tem como saber quem a escreveu.<br>Hoje vale por construção (não existe gerador, e não existe operação que altere a acessível depois de gravada) e por revisão de código. Nada impede que um gerador entre depois. |
| **5 · A revogação produz efeito imediato, sem cache que sobreviva a ela** | `consentimentosMock.revogar` (`mock/familia.ts:330`) grava `revogadoEm` no próprio consentimento.<br>`situacaoConsentimento` (`compartilhado/src/dominio/regras.ts:224`) testa a revogação antes de tudo, sem carência.<br>`exigirAcessoEscola` relê o consentimento a cada chamada.<br>No cliente de API, `cache: 'no-store'` (`api/cliente.ts:41`). | *revogacao tem efeito imediato, sem carencia*<br>*a leitura seguinte a revogacao ja e negada e auditada*<br>*revogacao feita durante a latencia de uma leitura ja vale para ela* | **A ausência de cache é estrutural — não há camada de cache —, mas a verificação vai um pouco além do que parece.** O teste lê o cartão *antes* de revogar. Um cache dentro do serviço, da decisão ou do cartão, seria aquecido por essa leitura e serviria a seguinte. A quebra com um `Map` de permissões derrubou o teste.<br>**Não é verificado nada fora do serviço:** o `no-store` do cliente de API (stub, sem teste); um *service worker* (não existe ainda; quando o PWA offline entrar, a leitura da escola precisa ficar fora do cache em tempo de execução); e o que já está na tela. A revogação vale para a próxima leitura, e um cartão aberto continua aberto até o professor sair dele. |
| **6 · Toda leitura e escrita de dado do paciente é registrada, com a concessão e a negativa; registro imutável** | `auditar` (`mock/infra.ts:143`): `Object.freeze` em cada registro, acrescentado ao fim da trilha.<br>`negar` (`mock/infra.ts:170`) audita toda negativa de perfil ou alcance; `exigirAcessoEscola` audita a negativa por consentimento (`mock/escola.ts:67`).<br>Concessão em `conceder` e `aceitar`. Leitura autorizada em `obterCartao`, `listarAlunos`, `pacientes.obter`, `planos.obterPorPaciente`, `sessoes.listarPorPaciente`, `ocorrencias.listarPorPaciente`, `familia.listarObjetivos`, `relatorios.obter`, `indicadores.listarAlertas` e `auditoria.exportar`.<br>Contrato `ServicoAuditoria` (`compartilhado/src/contratos.ts:150`): só `listar` e `exportar`. Tipo `RegistroAuditoria` com campos `readonly` (`compartilhado/src/tipos.ts:781`). | *registros sao congelados*<br>*o contrato de auditoria so tem leitura*<br>*a concessao fica auditada com o nome da escola*<br>*le o cartao com consentimento vigente, e a leitura e auditada* · *a lista de alunos nao mostra quem nunca concedeu, e a consulta e auditada*<br>*a ficha de paciente de outro profissional e negada ao terapeuta*, e outras três que conferem a negativa na trilha | **Imutável, mas só o registro, não a trilha.** Os campos são `readonly`, o que o TypeScript verifica em tempo de compilação. **Em tempo de execução também há algo:** `Object.freeze` em cada registro, e um teste confere. Só que `banco.auditoria` é um *array* comum. Remover um registro — a quebra apagou a concessão ao revogar — passou pelos 173 testes. Imutabilidade de verdade é permissão de banco, tabela só de inserção, e isso é do servidor.<br>**O mock não cumpre a regra 6.** Parte das leituras e escritas de dado do paciente não deixa registro; a lista está no achado 2, com destino na Etapa 10. Das que deixam, só as duas leituras da escola, `obterCartao` e `listarAlunos`, têm teste que falha sem o registro: tirar a auditoria da leitura da ficha passou pelos 173. O teste dos três momentos só confere que cada tipo aparece ao menos uma vez.<br>Tentativa sem sessão (`NAO_AUTENTICADO`) não entra na trilha: não há quem registrar. |

### A mesma tabela, separada pelos três tipos de garantia

- **Provado por teste:** quem pode conceder — só o responsável legal — e quem
  pode encerrar — qualquer responsável vinculado —, as 72 horas, o uso único do
  convite, a administração não criar professor; o escopo e a revogação na
  leitura da escola; o cartão sem os oito termos proibidos e o professor negado
  nos serviços que os testes chamam; a redação acessível obrigatória e gravada
  como foi escrita; a leitura seguinte à revogação negada, mesmo com cache
  dentro do serviço; o registro congelado, o contrato da trilha só de leitura e
  a concessão, as duas leituras da escola e a negativa auditadas.
- **Garantido por construção:** não haver autocadastro de professor; não haver
  gerador nem edição da redação acessível; não haver camada de cache; a escola
  ter só as quatro operações do seu contrato; não haver operação que apague ou
  altere registro da trilha.
- **Convenção de front-end:** o `no-store` do cliente de API; nenhum botão gerar
  a redação acessível na tela 6; e, até o servidor existir, todas as linhas
  acima. É o que diz a seção 6.

---

## 3. Achados

A primeira leitura encontrou três. O primeiro foi corrigido no código; o
segundo é pendência, com destino na Etapa 10; o terceiro virou texto da regra 2.

### Achado 1 — a restrição ao responsável legal só existia na interface (resolvido)

A ficha do paciente (tela 5) marca cada responsável como "Responsável legal" ou
"Não responde legalmente", e o comentário do componente diz que só o primeiro
autoriza a escola (`src/app/clinica/Ficha.tsx:22`). O serviço não verificava
isso: Gustavo Ferrer, pai de Noah e com `responsavelLegal = false` nos dados de
demonstração, concedeu acesso à escola, e o consentimento nasceu `VIGENTE`.

**Correção.** A regra 1 passou a dizer "Responsável legal".
`exigirResponsavelLegal` (`mock/acesso.ts:52`) entrou em `conceder` e em
`reemitirConvite`, porque convite novo também amplia o acesso. A negativa entra
na trilha como qualquer outra. `revogar` ficou sem a exigência, de propósito:
ampliar o acesso exige a autoridade legal, e encerrar não pode ser dificultado.
Nas telas 15 e 17, quem não é responsável legal vê as autorizações e pode
encerrá-las, sem nenhuma oferta de autorizar.

### Achado 2 — leituras e escritas de dado do paciente sem registro (pendente, Etapa 10)

A regra 6 exige o registro de toda leitura e escrita de dado do paciente: é a
meta do pré-projeto, *100% das operações de leitura e escrita sobre dado
sensível registradas*. A redação de 12/10, que tratava a regra como piso e só
obrigava o registro na fronteira da clínica, foi revogada em 13/10 (`docs/08`):
foi escrita sem o pré-projeto à vista.

**O mock não cumpre a regra, e não vai ser ajustado** — ele sai na Etapa 12. No
servidor, um interceptador registra toda leitura e escrita de dado do paciente,
sem depender de cada função lembrar de auditar (`docs/07`, D7, Etapa 10). As
tabelas abaixo são o que o interceptador precisa cobrir, e o que o teste portado
precisa conferir.

**Leituras sem registro**

| Operação | Quem lê |
|---|---|
| `sessoes.obter`, `sessoes.listarAgenda`, `sessoes.listarPendentesDeSincronizacao` | Equipe clínica |
| `pacientes.listar`, `planos.listarAguardandoValidacao` | Equipe clínica |
| `relatorios.previsualizar`, `relatorios.listarPorPaciente` | Equipe clínica |
| `ocorrencias.listarAvisosDaEscola` | Equipe clínica |
| `atividades.listarPorPaciente`, `obter` e `listarExecucoes` | Equipe clínica ou família |
| `consentimentos.listarPorPaciente` | Equipe clínica ou família |
| `familia.listarFilhos` | Família |
| `convites.obter` | Quem tem o token, sem sessão |

**Escritas sem registro**

| Operação | Quem escreve |
|---|---|
| `sessoes.registrarAtividade`, `sessoes.desfazerUltimoRegistro`, `sessoes.pausar` | Quem conduz a sessão |
| `ocorrencias.registrarNaSessao` | Quem conduz a sessão |
| `atividades.registrarExecucao` | Família |

**Já registradas no mock:** as leituras `pacientes.obter`,
`planos.obterPorPaciente`, `sessoes.listarPorPaciente`,
`ocorrencias.listarPorPaciente`, `relatorios.obter`, `indicadores.listarAlertas`,
`familia.listarObjetivos`, `areaEscola.obterCartao` e `areaEscola.listarAlunos`;
as escritas de plano e objetivo, a prescrição e o encerramento de atividade, a
abertura e o encerramento de sessão, a ocorrência da escola e a leitura clínica,
o cadastro de paciente e a emissão de relatório; a concessão, a revogação e o
convite; e a exportação da trilha.

**Decidido pelo Cowork em 13/10, fora da regra 6:**

- os indicadores agregados — `resumo`, `sessoesPorProfissional` e `ponteEscola` —
  devolvem contagens da clínica inteira, sem paciente identificado. Não são dado
  do paciente, e ficam fora da regra 6;
- a listagem da trilha, `auditoria.listar`, continua sem registro, pela decisão
  escrita em `mock/gestao.ts:45`: a trilha registrando a própria leitura viraria
  ruído. A exportação, `auditoria.exportar`, continua registrada.

### Achado 3 — a lista de alunos não passa pela verificação de consentimento (registrado)

`listarAlunos` (`mock/escola.ts:86`) devolve, de quem já concedeu algum dia, o
primeiro nome, a turma, o turno, a escola, a validade e a situação, **inclusive
depois da revogação**. Os escopos saem vazios quando não há vigência (`:113`). A
razão é o passo 27 do diagrama de sequência: a linha que some sem explicação faz
o professor supor defeito.

A exceção entrou na regra 2 do CLAUDE.md, com a lista exata dos campos. Turma,
turno e escola são os que o próprio professor declarou ao aceitar o convite ou
viu nele; nenhum campo é clínico.

---

## 4. Como os testes foram conferidos

Cada linha é uma quebra feita de propósito, com a suíte inteira rodando contra
ela. Nada disto foi commitado. A árvore voltou ao estado do commit depois de cada
quebra.

| Quebra | Testes que falharam |
|---|---|
| `conceder` aceita professor, terapeuta e coordenador | 2: os dois de quem não concede |
| Convite com 96 horas | 2: o de 72 horas no serviço e o da função pura |
| Aceitar não grava `usadoEm` | 1: *os quatro estados do convite* |
| A administração cria professor e responsável | 1 |
| `conceder` sem `exigirResponsavelLegal` | 1: *responsavel nao legal recebe ACESSO_NEGADO ao conceder* |
| `reemitirConvite` sem `exigirResponsavelLegal` | 1: *gerar convite novo tambem amplia o acesso* |
| `revogar` passa a exigir `exigirResponsavelLegal` | 1: *responsavel nao legal consegue revogar* |
| `obterCartao` sem `exigirAcessoEscola` | 2: **os dois da regra 5**, nenhum da regra 2 |
| Escopo ignorado | 2 |
| `nivelSuporte` no cartão, por *spread* | 1: *o cartao nao carrega nenhum campo clinico* |
| `alcancaClinicamente` verdadeiro para o professor | 3 |
| Gerador **no serviço**: preenche a acessível a partir da técnica, sem validação | 2 |
| Gerador **na tela 6**: o mesmo, antes de enviar | **0** |
| `revogadoEm` ignorado | 9 |
| Cache de permissão dentro de `exigirAcessoEscola` | 1: *a leitura seguinte a revogacao ja e negada e auditada* |
| Registro de auditoria sem `Object.freeze` | 1 |
| Leitura do cartão sem auditoria | 1 |
| Lista de alunos sem auditoria | 1: *a lista de alunos nao mostra quem nunca concedeu, e a consulta e auditada* |
| `negar` sem auditoria | 4 |
| Concessão registrada como `CRIACAO` | 1 |
| Revogar apaga a concessão da trilha | **0** |
| Leitura da ficha sem auditoria | **0** |
| `fimDaValidade` à meia-noite UTC do dia seguinte, a semântica antiga | 3: *vigente as 23:59:59.999 de Manaus no dia da validade; expirado a 00:00 do dia seguinte*, uma vez por fuso da máquina |
| `fimDaValidade` à 00:00 do próprio dia | 4: os três acima e *a validade vale o dia inteiro, e expira a 00:00 do dia seguinte em Manaus* |
| `emDataCivil` passando por `Date`, no fuso da máquina | 1: só com a máquina em Manaus. Em UTC e em Tóquio, a meia-noite UTC ainda cai no mesmo dia |
| `diaCivilEm` no fuso da máquina, e não no de Manaus | 4: o do aniversário e o do dia civil, com a máquina em UTC e em Tóquio |

As três linhas com zero são as que a tabela da seção 2 chama de "não prova".

---

## 5. Conferência no navegador

Feita em 12/10/2026, no servidor de desenvolvimento, com os dados de
demonstração.

**Tela 2, os quatro estados do token.** `demo-convite-valido` mostra quem
convidou, o aluno e a escola, o que o professor poderá ver, a validade e **"O que
você nunca verá" antes do formulário**, conferido pela posição no documento.
`demo-convite-usado`, `demo-convite-expirado` e `demo-convite-revogado` mostram
cada um título e texto próprios, sem formulário, com o caminho para a entrada do
sistema.

**História 1 — a família autoriza, o professor aceita e lê, a leitura fica
registrada.** A responsável autorizou a Escola Municipal Vitória-Régia para
Miguel, nos dois escopos, depois de abrir o termo. O convite foi aberto sem
sessão, e a conta de professor nasceu do aceite. A tela seguinte foi "Meus
alunos", e dali o cartão abriu. Na trilha, filtrada por entidade, aparecem, nesta ordem, a concessão da
família (`Consentimento`, com escola e escopos), a concessão do aceite
(`VinculoEscolar`) e a leitura autorizada do cartão.

**História 2 — a família encerra, o professor é recusado, a recusa fica
registrada.** A responsável encerrou o acesso, nas duas etapas. Ao entrar de novo,
o professor viu Miguel em "Meus alunos" marcado como "Acesso encerrado pela
família", sem caminho para o cartão. Pelo endereço que já conhecia, o cartão
recusou na primeira chamada: "A família encerrou o acesso a estas informações."
Em "Só tentativas negadas", a tentativa aparece com o nome do professor,
`CartaoEstrategia` e o motivo `REVOGADO`.

No servidor de desenvolvimento, cada leitura disparada por uma tela aparece duas
vezes na trilha. É o `StrictMode` do React executando o efeito duas vezes; no
build de produção sai uma vez só.

---

## 6. O limite

Tudo isto executa no navegador. As verificações demonstram onde a regra mora e
como se verifica, mas não constituem fronteira de confiança — quem roda o código
controla o cliente. Por isso a implementação de API, escrita contra os mesmos
contratos, não aplica regra de acesso nenhuma (`src/servicos/api/index.ts`): ali
quem decide é o servidor.

Este parágrafo e a seção 6.1.3 do artigo precisam dizer a mesma coisa. Mudou um,
muda o outro.

---

## 7. Servidor

Desde o passo 4 da Etapa 9 (14/10/2026), e com as migrações `caminhos_coerentes`
e `chaves_compostas_sem_cascata` do passo 4b, o servidor tem banco: PostgreSQL 17,
com o esquema em `servidor/prisma/schema.prisma` e a primeira migração em
`servidor/prisma/migracoes/`. Os testes do servidor rodam contra um banco de
verdade: um PostgreSQL 17 embutido e descartável na máquina de desenvolvimento,
o serviço `postgres:17` no CI. A seção 6 continua valendo para o mock; no
servidor, a primeira garantia que muda de categoria é a imutabilidade.

| O que | Onde é aplicado | Teste que falha se for violado | O que esse teste não prova |
|---|---|---|---|
| **A trilha de auditoria e o relatório emitido só crescem** (regra 6; documento clínico emitido) | Migração inicial: a função `recusar_alteracao()` e quatro *triggers* — `BEFORE UPDATE OR DELETE`, por linha, e `BEFORE TRUNCATE`, por comando, em `registro_auditoria` e em `relatorio_evolucao`. | `test/imutabilidade.test.ts`, nas duas tabelas: o INSERT passa; UPDATE e DELETE pelo cliente do Prisma são recusados; UPDATE, DELETE e TRUNCATE por SQL cru são recusados; a linha continua como foi gravada. | **O dono da tabela pode desligar o *trigger*** (`ALTER TABLE … DISABLE TRIGGER`) ou apagar a função. A proteção é a aplicação conectar com um papel que não é dono: a linha seguinte. |
| **A aplicação não é dona do banco** (regra 6; `docs/07`, D4) | `servidor/prisma/papel-aplicacao.exemplo.sql`: o papel `sinctea_app` só com `SELECT`, `INSERT`, `UPDATE` e `DELETE`, sem `CREATE` no esquema, sem `TRUNCATE` e sem posse de tabela. As migrações rodam no GitHub Actions, com o papel dono; a credencial dele não entra no Render. | `test/papel.test.ts`, que roda o próprio modelo versionado: o papel faz `INSERT` e `SELECT` na auditoria e altera e apaga linha de outra tabela; `UPDATE` e `DELETE` na auditoria são recusados pelo *trigger*; `TRUNCATE` por falta de privilégio; `DISABLE TRIGGER` por não ser dono; `CREATE TABLE` por falta de `CREATE` no esquema. | **O teste prova o modelo, não o Neon.** Que o Render conecta com `sinctea_app`, e não com o dono, é configuração da conta, conferida à mão no passo 5.<br>O papel ainda pode apagar linha das tabelas que não têm *trigger*. Isso é permissão de aplicação; quem decide o que se apaga é o serviço. |
| **Faixas fechadas e atributos [1..*]** (`docs/01`, seção 7) | Onze CHECKs na migração inicial. | `test/checks.test.ts`: `nivelSuporte` 4, intensidade 6 e escopos vazio são recusados, cada um conferido pelo nome da restrição, com o valor de dentro da faixa passando ao lado. | **Só três dos onze CHECKs têm teste.** Os de intensidade da ocorrência escolar, dos dois percentuais e de `perfis`, `passos`, `oQueFazer`, `oQueEvitar` e `objetivoIds` existem por construção. |
| **Caminhos coerentes:** quando uma linha chega a outra por dois caminhos, os dois levam ao mesmo lugar | Migração `caminhos_coerentes`: cinco chaves estrangeiras compostas — `vinculo_escolar` → consentimento e → convite, `ocorrencia_escolar` → vínculo, `ocorrencia_comportamental` → ocorrência da escola e → sessão — e três funções de *trigger*: o objetivo de atividade de casa e de registro de sessão é do mesmo paciente; os objetivos do relatório existem e são do paciente; o dono de plano, objetivo e sessão não muda. Composição sem cascata: apagar plano com objetivo ou sessão com registro é recusado.<br>Migração `chaves_compostas_sem_cascata`: as cinco chaves compostas com `ON UPDATE RESTRICT`. Com `CASCADE`, o padrão do Prisma, trocar o paciente de um consentimento levaria junto, em silêncio, o vínculo e as ocorrências para outro paciente. | `test/caminhos.test.ts`: para cada chave e cada *trigger*, o caso incoerente é recusado pelo nome da restrição ou pela mensagem, e o coerente passa; trocar o dono de plano, objetivo ou sessão é recusado; apagar um plano com objetivos é recusado.<br>Sem cascata na atualização: trocar o paciente de consentimento com vínculo, o paciente ou o professor de vínculo com ocorrência, o consentimento de convite já aceito e o paciente de ocorrência da escola que gerou evento comportamental é recusado, cada um pelo nome da chave de quem aponta; outra coluna continua alterável. | **A chave de `ocorrencia_comportamental` → sessão não tem teste que a alcance.** A troca do paciente da sessão é recusada antes, pelo *trigger* `sessao_dono_fixo`; a chave fica como segunda barreira.<br>A restrição só vale com alguém apontando: o paciente de um consentimento sem vínculo ainda pode ser trocado no banco. Nenhuma operação do contrato faz isso. |
| **Autenticação de verdade** (`docs/07`, D5; seção 0, item 1) | `servidor/src/autenticacao/`: senha em argon2id; sessão no PostgreSQL (`sessao_login`), com cookie `httpOnly`, `Secure` e `SameSite=Lax`, que vale 24 horas desde o último uso; o banco guarda só o resumo SHA-256 do token, com CHECK do formato. Primeiro acesso por link (`acesso_inicial`): 72 horas, uso único garantido na própria gravação, só o resumo do token. E-mail gravado em minúsculas, com CHECK. Limite de tentativas: 5 senhas erradas para o mesmo e-mail em 15 minutos, ou 20 do mesmo IP, bloqueiam por 15 minutos, antes de conferir a senha. | `test/autenticacao.test.ts`: a mesma recusa para e-mail inexistente, senha errada e conta desativada; os atributos do cookie; só o resumo no banco; sair, vencer e desativar a conta derrubam a sessão; trocar para perfil que a conta não tem é negado e registrado; o link mostra nome e e-mail só quando vale, gasta-se uma vez — mesmo com dois pedidos ao mesmo tempo —, vence em 72 horas e é substituído pelo mais novo; o limite bloqueia o e-mail na sexta tentativa, mesmo com a senha certa, e libera depois de 15 minutos; vale igual para e-mail que não existe e para outra caixa do mesmo e-mail; acertar zera a contagem do e-mail; 20 erradas bloqueiam o IP. `test/comandos.test.ts`: o primeiro administrador nasce com argon2id, e-mail em minúsculas e a criação na trilha, e o segundo é recusado. | **O limite de tentativas mora na memória do processo.** O Render roda uma instância só, e reiniciar o servidor zera a contagem.<br>O `Secure` depende do HTTPS do Render; em `http://localhost`, o navegador aceita o cookie por exceção.<br>O tempo de resposta igual para e-mail existente ou não é construção (confere-se a senha contra um hash sem dono), e não tem teste. |
| **Toda leitura e escrita de dado do paciente é registrada pelo interceptador, e toda negativa pelo filtro** (regra 6; `docs/07`, D7) | `servidor/src/acesso/`: toda rota declara a auditoria, com `@Auditar` ou `@SemDadoDoPaciente`, e a guarda recusa a rota sem declaração. `InterceptadorAuditoria` grava o registro antes de a resposta sair; `FiltroErros` registra todo `ACESSO_NEGADO`, venha da guarda ou do serviço. | `test/autenticacao.test.ts`, com um controlador de teste: sem sessão, 401 e nada na trilha; perfil errado, 403 e a negativa registrada com o paciente; leitura autorizada registrada com paciente, perfil e origem; se o banco recusar o registro, o dado não sai; rota sem declaração não responde. `test/rotas.test.ts` percorre os controladores registrados e exige a declaração em cada rota. | **Hoje só o controlador de teste lê dado do paciente.** As rotas de verdade chegam no item 3, e cada uma precisa da declaração certa: o teste de rotas acusa a ausência, não o paciente errado.<br>**Limite declarado até 19/10:** a escrita é registrada depois de gravada, fora da transação dela. Se o registro falhar, a escrita fica e a resposta é erro. Depois de 19/10, a escrita e o registro passam para a mesma transação. |
| **Só a equipe nasce pela gestão de usuários, e a senha é da pessoa** (regra 1; `docs/07`, seção 0, item 2) | `servidor/src/usuarios/`: `convidar` só concede perfis de equipe, com o e-mail normalizado, e a conta nasce com uma senha que ninguém conhece e o link de primeiro acesso; o link novo invalida o anterior e só serve à equipe ativa; ninguém tira o próprio perfil de administrador nem desativa a própria conta; desativar encerra todas as sessões; os dados profissionais só o dono altera. | `test/usuarios.test.ts`: outro perfil é negado e a negativa é registrada — inclusive na rota cuja declaração dependeria da resposta; responsável e professor são recusados no `convidar`; e-mail repetido em outra caixa é conflito; a pessoa entra só pela senha que definiu no link; o link anterior some; quem perde o perfil ativo cai na chamada seguinte; desativar derruba as sessões; id que não é uuid é 404. | **Quem gera o link poderia usá-lo.** Sem servidor de e-mail, o link passa pela mão de quem cadastra; a trilha registra quem o gerou, e a pessoa descobre no primeiro acesso, porque o link já terá sido usado.<br>**Limite declarado em 16/10: responsável e professor não recuperam a senha.** Só a equipe recebe link novo, pela administração; a clínica não troca a senha de quem autoriza a escola. Fica assim até existir envio de e-mail, depois de 19/10. |
| **A clínica no servidor: alcance, regras 3 e 4, e a trilha com o paciente** (`docs/07`, seção 0, item 3) | `servidor/src/clinica/`: a guarda de perfis da clínica (terapeuta e coordenação) e o alcance (`alcance.ts`: o terapeuta, só a equipe do paciente; a coordenação, todos) antes de qualquer dado; a negativa leva o paciente para a trilha, mesmo quando a rota chega pelo plano, pelo objetivo ou pela sessão; a redação acessível é exigida e gravada como veio; o cartão só existe com conteúdo; quem escreve o plano não o valida; só quem conduz a sessão registra nela; a clínica só gera link para o responsável que ainda não definiu a senha. | `test/clinica.test.ts`: terapeuta de fora não vê, não lê e não escreve, e a negativa é registrada com o paciente; professor, administrador e quem não tem sessão são recusados em toda rota da clínica (regra 3); objetivo sem redação acessível e cartão em branco são recusados, e o que foi escrito é gravado como veio (regra 4); cada leitura, cada escrita — inclusive cada tentativa da sessão — entra na trilha com o paciente; o autor não valida o próprio plano; o encerramento atualiza o medidor; o domínio exige o critério. | **Duas barreiras, e o teste exercita uma.** Dar ao professor alcance clínico só no `alcance.ts` não derruba teste nenhum: a guarda de perfis recusa antes. O contrário — tirar a guarda e manter o alcance — derruba.<br>Os eventos comportamentais da ficha, a evolução, as atividades e o relatório ficam para depois de 19/10, e não têm teste contra a API. |
| **Família, escola, consentimento e convite: as regras 1, 2, 3, 5 e 6 contra a API** (`docs/07`, seção 0, item 4) | `servidor/src/familia/` e `servidor/src/escola/`: só o responsável legal concede e reemite o convite (`exigirResponsavelLegal`), e qualquer responsável vinculado encerra; o convite vale 72 horas, gasta-se uma vez na própria gravação, e o banco guarda só o resumo do token; a escola só lê por `exigirAcessoEscola`, que relê o consentimento e o escopo a cada chamada, sem cache; o cartão sai projetado campo a campo, e a família recebe do objetivo só a redação acessível; a negativa leva o motivo e o paciente para a trilha; a família cadastra a escola depois de ver as parecidas do mesmo município; o professor de mais de um aluno usa a mesma conta, com a senha dela, e a senha errada conta no limite de tentativas. | `test/escola.test.ts`, num banco que começa vazio: o responsável não legal que tenta conceder ou reemitir é recusado, e a tentativa fica na trilha com o paciente; o não legal encerra, e a leitura seguinte da escola já é negada, com o motivo; convite usado ou vencido não serve, e a tentativa fica na trilha; o convite novo derruba o anterior; os dois duram 72 horas; o banco tem o resumo, e não o token; fora do escopo, sem vínculo, revogado e vencido, cada um com o seu motivo; o cartão tem só as chaves da projeção e nada da redação técnica, e os objetivos da família também não; cada leitura, concessão, revogação e negativa está na trilha; e-mail da equipe não aceita convite; a senha errada no convite e na entrada somam no mesmo limite; só quem registrou corrige a ocorrência, em 30 minutos, e a versão anterior fica em `valorAnterior`. | **O uso único na corrida não tem teste.** Tirar `usadoEm: null` da gravação do aceite não derruba nada: a checagem anterior recusa o convite usado, e só dois aceites ao mesmo tempo chegariam à gravação. O primeiro acesso tem esse teste; o convite, não.<br>**Quem tem o link do convite pode aceitá-lo**, como no primeiro acesso: o convite passa pela mão da família, e a tela 17 mostra a ela quem aceitou.<br>A ocorrência da escola entra como evento preliminar, mas a clínica ainda não a lê pela API: os avisos da escola ficam para depois de 19/10, e a tela 19 diz que o registro foi guardado, e não que a terapeuta foi avisada. |
| **O relato da escola chega à clínica, e a leitura clínica é do profissional** (`docs/07`, seção 0, item 6; regras 3 e 6) | `servidor/src/clinica/servico-ocorrencias.ts`: os eventos da ficha passam por `exigirPacienteClinico`; os avisos, pelo mesmo `alcancaClinicamente`, de `alcance.ts`; só o evento da escola ainda sem leitura, registrado nos últimos sete dias. A leitura clínica confere o alcance, recusa o evento já lido e grava com a condição `leituraClinicaEm: null`, para que dois pedidos ao mesmo tempo não gravem duas. As três rotas declaram a auditoria. | `test/ocorrencias.test.ts`, num banco que começa vazio e com o caminho inteiro pelas rotas: o relato do professor aparece como aviso para a equipe e a coordenação, e não para o terapeuta de fora; na ficha, como evento preliminar com a origem; fora da equipe, a ficha e a leitura negam e a negativa fica com o paciente; professor e responsável são recusados nas três rotas; a leitura sai da lista de avisos e fica na ficha; a segunda leitura é conflito; quatro pedidos ao mesmo tempo gravam uma leitura e um registro; o aviso vale por sete dias; encerrado o acesso da escola, o relato continua na clínica. | **A lista de avisos atravessa pacientes**, e a trilha guarda quantos avisos saíram, sem dizer de quem — como a lista de pacientes.<br>**Duas barreiras na leitura, e cada uma sozinha segura a outra:** tirar a conferência do evento já lido não derruba teste nenhum, porque a trava da gravação recusa; tirar a trava só derruba o teste de corrida.<br>O registro de ocorrência na sessão continua fora do caminho principal. |
| **A versão publicada fala só com a API, e o mock não vai junto** (`docs/07`, seção 0, item 5) | `src/servicos/index.ts`: no build de produção, só a API, no `/api` do mesmo endereço. `vite.config.ts`, plugin `semMockNoPacote`: no build, o `./mock` vira um módulo vazio. `src/app/caminhoPrincipal.ts`: as telas fora do caminho principal saem das rotas e do menu, e as seções que dependem delas saem da ficha, da sessão, do painel da família e da fila de planos. A entrada de demonstração só existe com o mock. O servidor manda `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` e `X-Frame-Options: DENY` em toda resposta, antes dos arquivos do front. | `src/publicacao.test.ts` roda o próprio build de produção e confere o pacote: fala com `/api`; não tem a senha de demonstração nem os personagens da semente; não tem a entrada de demonstração, a vitrine, nem um texto próprio de cada tela escondida; tem o aviso do ambiente. `servidor/test/front.test.ts`: os três cabeçalhos no `index.html`, num arquivo do front, na API e no 404, e sem `X-Powered-By`. | **O teste confere o pacote pelo texto.** Uma tela escondida que não tenha nenhum dos textos procurados passaria; a rota ausente se confere no navegador.<br>Os nomes do menu das telas escondidas continuam no pacote, filtrados em tempo de execução: o teste procura textos de dentro das telas, e não do menu.<br>O aviso do ambiente é conferido no pacote, e não em cada lugar onde aparece. |
| **A semente é a do mock, e só fictícia** | `servidor/prisma/semente.ts`, sobre `semente/dados.ts`, portado do mock. | `test/semente.test.ts`: a contagem de cada uma das 22 tabelas é a dos dados, e nenhuma está vazia; toda senha está em argon2id; o hash de cada relatório é o do conteúdo gravado; o resumo de cada termo confere com o consentimento gravado; todo e-mail é `.example`; nenhum token de convite é fixo; a semente se recusa sem senha e com usuário no banco. | A contagem vem dos mesmos dados que a semente grava: prova que nada se perdeu na gravação, e não que os dados estão certos. |
| **A dependência entre pacotes só vai num sentido** (`docs/01`, seção 1) | — | `src/arquitetura.test.ts`: `compartilhado/` não importa de `src/` nem de `servidor/`; `servidor/` não importa de `src/`; `src/` não importa de `servidor/` nem de `@prisma`. | Confere só o texto dos imports. Um import montado em tempo de execução (`import(variavel)`) passaria. |

### Quebras feitas no servidor

| Quebra | Testes que falharam |
|---|---|
| Migração sem o *trigger* de linha de `registro_auditoria` | 3: UPDATE e DELETE pelo cliente, os três por SQL cru, e a linha intacta |
| Migração sem o *trigger* de TRUNCATE de `relatorio_evolucao` | 2: os três por SQL cru e a linha intacta |
| Migração sem o CHECK de `nivelSuporte` | 1: *nivelSuporte 4 e recusado; 3 passa* |
| `servidor/` importando de `src/` por caminho relativo | 1 |
| `src/` importando de `servidor/` por caminho relativo | 1 |
| Chave composta `vinculo_escolar(consentimentoId, pacienteId)` rebaixada a simples | 1: *vinculo_escolar: o consentimento e do mesmo paciente* |
| Chave composta `ocorrencia_escolar(vinculoId, pacienteId, professorId)` rebaixada a simples | 1: *ocorrencia_escolar: o vinculo e do mesmo paciente e do mesmo professor* |
| Sem o *trigger* `registro_atividade_mesmo_paciente` | 1: *registro_atividade: o objetivo e do paciente da sessao* |
| Sem o *trigger* `plano_dono_fixo` | 1: *trocar o paciente do plano, o plano do objetivo ou o paciente da sessao e recusado* |
| Chave `vinculo_escolar(consentimentoId, pacienteId)` com `ON UPDATE CASCADE` | 1: *trocar o paciente de um consentimento com vinculo e recusado* |
| Chave `vinculo_escolar(conviteId, consentimentoId)` com `ON UPDATE CASCADE` | 1: *trocar o consentimento de um convite ja aceito e recusado* |
| Chave `ocorrencia_escolar(vinculoId, pacienteId, professorId)` com `ON UPDATE CASCADE` | 2: *trocar o paciente ou o professor de um vinculo com ocorrencia e recusado* e, por arrasto, o seguinte: a troca de professor passou, levou as ocorrências junto, e a ocorrência nova do teste seguinte já não encontrou o vínculo com o professor original |
| Chave `ocorrencia_comportamental(ocorrenciaEscolarId, pacienteId)` com `ON UPDATE CASCADE` | 1: *trocar o paciente de uma ocorrencia da escola que ja gerou evento comportamental e recusado* |
| Chave `ocorrencia_comportamental(sessaoId, pacienteId)` com `ON UPDATE CASCADE` | **0**: o *trigger* `sessao_dono_fixo` recusa a troca antes de a chave ser consultada |
| Papel da aplicação com `CREATE` no esquema | 1: *criar tabela e recusado: sem CREATE no esquema* |
| Papel da aplicação com `TRUNCATE` na auditoria | 1: *TRUNCATE e recusado por falta de privilegio* — o *trigger* de TRUNCATE ainda recusaria, mas com outra mensagem |
| Papel da aplicação dono da auditoria | 2: o de `TRUNCATE` e *desligar o trigger e recusado: o papel nao e dono da tabela* |
| Modelo do papel sem `ALTER DEFAULT PRIVILEGES` | 1: *toda tabela criada pelas migracoes da ao papel SELECT, INSERT, UPDATE e DELETE* |
| A guarda deixa passar perfil sem permissão | 1: *perfil sem permissao: 403, e a negativa entra na trilha com o paciente* |
| A guarda aceita rota sem declaração de auditoria | 1: *rota sem declaracao de auditoria nao responde* |
| O interceptador não registra a leitura | 2: a leitura autorizada e o dado que não sai sem registro |
| O interceptador grava o registro sem esperar a gravação | 1: *se o registro nao puder ser gravado, o dado nao sai*. **Passou na primeira vez:** a falha simulada estourava antes da espera. Com uma recusa de verdade do banco, que chega depois, o teste cai |
| O filtro não registra a negativa | 2: a troca de perfil negada e o perfil sem permissão |
| O login diz quando o e-mail não existe | 1: *a mesma recusa para e-mail inexistente, senha errada e conta desativada* |
| Sair não apaga a sessão do banco | 1 |
| Sessão vencida continua valendo | 1 |
| Cookie sem `HttpOnly` | 1 |
| O banco guarda o token, e não o resumo | 16: o CHECK do formato recusa a gravação, e quase tudo cai |
| Primeiro acesso sem a trava de uso único na gravação | 1: *dois pedidos ao mesmo tempo com o mesmo link: so um define a senha* |
| Limite de tentativas desligado, por e-mail e por IP | 4: os do e-mail e o do IP |
| Limite de tentativas só por e-mail, sem o do IP | 1: *por IP: 20 erradas, em e-mails diferentes, bloqueiam o IP* |
| `convidar` aceita responsável e professor | 1 |
| `convidar` não normaliza o e-mail | 2: o CHECK do banco recusa a maiúscula |
| O administrador tira o próprio perfil de administrador | 5: o primeiro teste tira, e os seguintes perdem quem administra |
| Desativar não encerra as sessões | 1 |
| Link novo não invalida o anterior | 1 |
| Dados profissionais sem conferir quem é profissional | 1: o responsável recebe erro do banco, e não a recusa |
| O filtro volta a depender da resposta para registrar a negativa | 1: *outro perfil e negado ao listar e ao convidar*. **Foi um defeito de verdade, achado por este teste:** a negativa do `convidar` não entrava na trilha |
| O terapeuta alcança qualquer paciente | 4 |
| O professor alcança dado clínico, só no alcance | **0**: a guarda de perfis recusa antes |
| A clínica sem a guarda de perfis, só com o alcance | 1: a lista de pacientes devolve vazio, e não recusa |
| Objetivo sem a validação da redação acessível (regra 4) | 1 |
| Cartão sem a validação do conteúdo | 1 |
| A negativa perde o paciente que o serviço conhece | 2 |
| A leitura e a escrita perdem o paciente que o controlador conhece | 4 |
| Qualquer um da equipe registra na sessão de outro | 1 |
| Quem escreveu o plano o valida | 1 |
| A clínica gera link para responsável que já definiu a senha | 1 |
| Encerrar não atualiza o medidor do objetivo | 1 |
| Domínio sem conferir o critério | 2 |
| Primeiro acesso aceita link vencido | 1: *link vencido: EXPIRADO, e nao define senha*. **Passou na primeira vez:** a trava da gravação também recusa link vencido, com outra mensagem. O teste passou a conferir a mensagem |
| O responsável não legal concede (regra 1) | 1: *responsavel nao legal tenta conceder* |
| Encerrar exige o responsável legal | 2: *o responsavel nao legal encerra* e, por arrasto, *revogar de novo* |
| Reemitir o convite sem exigir o responsável legal | 13: *reemitir o convite tambem amplia o acesso* e, por arrasto, doze: o convite que o pai gerou derrubou o da mãe, e a professora não chegou a entrar |
| O aceite sem conferir antes a situação do convite | 1: *usado uma vez*. A gravação ainda recusa, mas a tentativa não entra na trilha |
| O aceite sem `usadoEm: null` na gravação | **0**: a checagem anterior recusa antes; só uma corrida chegaria lá |
| O banco guarda um resumo que não é o do token | 16 |
| O convite reemitido dura 96 horas | 1. **Passou na primeira vez:** só o primeiro convite tinha a duração conferida. O teste passou a conferir os dois |
| O primeiro convite dura 96 horas | 1 |
| O e-mail da equipe aceita o convite | 5: *segundo aluno, mesmo e-mail* e, por arrasto, quatro seguintes |
| A senha errada do convite fora do limite de tentativas | 3: *a senha errada no convite conta no mesmo limite* e, por arrasto, dois: o aceite que devia ser bloqueado deu à professora um aluno a mais |
| A escola lê sem conferir o consentimento (regra 2) | 3: fora do escopo, revogado e vencido |
| A escola lê sem conferir o escopo | 1 |
| A redação técnica no cartão da escola (regra 3) | 1 |
| A redação técnica nos objetivos da família | 1 |
| A leitura da escola ignora a revogação (regra 5) | 1: *a leitura seguinte da escola ja e negada* |
| A leitura do cartão sem registro na trilha (regra 6) | 1 |
| A negativa da escola sem o paciente | 3 |
| A terapeuta cadastra escola | 1 |
| Outro professor corrige a ocorrência | 1 |
| A correção sem a versão anterior na trilha | 1 |
| Os eventos da ficha sem conferir o alcance (regra 3) | 1 |
| Os avisos sem o filtro de alcance | 1: o terapeuta de fora passa a ver o aviso, com o nome do paciente |
| Os avisos com os eventos já lidos | 2 |
| Os avisos sem a janela de sete dias | 1 |
| A leitura clínica sem conferir o alcance | 1 |
| A leitura clínica sem conferir o evento já lido | **0**: a trava da gravação recusa a segunda leitura |
| A leitura clínica sem a trava da gravação | 1: *quatro pedidos ao mesmo tempo*. **Passou na primeira vez:** a conferência anterior segurava a segunda leitura feita em sequência. O teste de corrida entrou, e derrubou a quebra nas três vezes em que ela rodou |
| A leitura clínica sem o paciente na trilha (regra 6) | 1 |
| A lista de avisos sem registro da consulta | 1 |
| O painel do terapeuta de novo fora da versão publicada | 1: *leva o ciclo clinica–escola do item 6* |
| O build sem o plugin que tira o mock | 1: *nao leva o mock* |
| A escolha da implementação volta a depender só de `VITE_API_URL` | 3: o mock, a entrada de demonstração e as telas escondidas voltam ao pacote |
| Todas as telas no caminho principal | 2: as telas escondidas e, por arrasto, a entrada de demonstração, que só some pela mesma condição |
| A entrada de demonstração sem a condição | 2: a entrada e, por arrasto, o mock — o bloco cita a senha de demonstração |
| A API sem `/api` como endereço padrão | 1 |
| Sem `X-Frame-Options` | 1 |
| Os arquivos do front registrados antes dos cabeçalhos | 1: o `index.html` e o arquivo do front saem sem eles |
| `src/` importando `@prisma/client`, `@prisma/adapter-pg`, `prisma/config` ou `@sinctea/servidor` | 1 em cada caso. **A de `@prisma/client` passou na primeira vez**: a expressão regular exigia uma barra depois de `@prisma/`. Corrigida, as quatro falham |

Cada quebra foi desfeita depois de rodar, e a migração ou o modelo do papel voltou idêntico, byte a
byte. Como cada execução cria um banco do zero, alterar a migração vale para o
teste seguinte sem tocar em banco nenhum já existente.
