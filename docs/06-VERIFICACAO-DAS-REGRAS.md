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
| **Só a equipe nasce pela gestão de usuários, e a senha é da pessoa** (regra 1; `docs/07`, seção 0, item 2) | `servidor/src/usuarios/`: `convidar` só concede perfis de equipe, com o e-mail normalizado, e a conta nasce com uma senha que ninguém conhece e o link de primeiro acesso; o link novo invalida o anterior e só serve à equipe ativa que ainda não definiu a senha (item 13); ninguém tira o próprio perfil de administrador nem desativa a própria conta; desativar encerra todas as sessões; os dados profissionais só o dono altera. | `test/usuarios.test.ts`: outro perfil é negado e a negativa é registrada — inclusive na rota cuja declaração dependeria da resposta; responsável e professor são recusados no `convidar`; e-mail repetido em outra caixa é conflito; a pessoa entra só pela senha que definiu no link; o link anterior some; quem perde o perfil ativo cai na chamada seguinte; desativar derruba as sessões; id que não é uuid é 404. | **Quem gera o link poderia usá-lo.** Sem servidor de e-mail, o link passa pela mão de quem cadastra; a trilha registra quem o gerou, e a pessoa descobre no primeiro acesso, porque o link já terá sido usado.<br>**Limite declarado em 16/10, revisto em 18/10 e em 25/10:** o responsável recupera a senha pela coordenação (item 8, abaixo); a equipe que já definiu a senha e o professor, pela administração, com motivo (item 13, abaixo). Sem envio de e-mail, o link continua passando pela mão de quem o gera. |
| **A clínica no servidor: alcance, regras 3 e 4, e a trilha com o paciente** (`docs/07`, seção 0, item 3) | `servidor/src/clinica/`: a guarda de perfis da clínica (terapeuta e coordenação) e o alcance (`alcance.ts`: o terapeuta, só a equipe do paciente; a coordenação, todos) antes de qualquer dado; a negativa leva o paciente para a trilha, mesmo quando a rota chega pelo plano, pelo objetivo ou pela sessão; a redação acessível é exigida e gravada como veio; o cartão só existe com conteúdo; quem escreve o plano não o valida; só quem conduz a sessão registra nela; a clínica só gera link para o responsável que ainda não definiu a senha. | `test/clinica.test.ts`: terapeuta de fora não vê, não lê e não escreve, e a negativa é registrada com o paciente; professor, administrador e quem não tem sessão são recusados em toda rota da clínica (regra 3); objetivo sem redação acessível e cartão em branco são recusados, e o que foi escrito é gravado como veio (regra 4); cada leitura, cada escrita — inclusive cada tentativa da sessão — entra na trilha com o paciente; o autor não valida o próprio plano; o encerramento atualiza o medidor; o domínio exige o critério. | **Duas barreiras, e o teste exercita uma.** Dar ao professor alcance clínico só no `alcance.ts` não derruba teste nenhum: a guarda de perfis recusa antes. O contrário — tirar a guarda e manter o alcance — derruba.<br>Os eventos comportamentais da ficha, a evolução, as atividades e o relatório ficam para depois de 19/10, e não têm teste contra a API. |
| **Família, escola, consentimento e convite: as regras 1, 2, 3, 5 e 6 contra a API** (`docs/07`, seção 0, item 4) | `servidor/src/familia/` e `servidor/src/escola/`: só o responsável legal concede e reemite o convite (`exigirResponsavelLegal`), e qualquer responsável vinculado encerra; o convite vale 72 horas, gasta-se uma vez na própria gravação, e o banco guarda só o resumo do token; a escola só lê por `exigirAcessoEscola`, que relê o consentimento e o escopo a cada chamada, sem cache; o cartão sai projetado campo a campo, e a família recebe do objetivo só a redação acessível; a negativa leva o motivo e o paciente para a trilha; a família cadastra a escola depois de ver as parecidas do mesmo município; o professor de mais de um aluno usa a mesma conta, com a senha dela, e a senha errada conta no limite de tentativas. | `test/escola.test.ts`, num banco que começa vazio: o responsável não legal que tenta conceder ou reemitir é recusado, e a tentativa fica na trilha com o paciente; o não legal encerra, e a leitura seguinte da escola já é negada, com o motivo; convite usado ou vencido não serve, e a tentativa fica na trilha; o convite novo derruba o anterior; os dois duram 72 horas; o banco tem o resumo, e não o token; fora do escopo, sem vínculo, revogado e vencido, cada um com o seu motivo; o cartão tem só as chaves da projeção e nada da redação técnica, e os objetivos da família também não; cada leitura, concessão, revogação e negativa está na trilha; e-mail da equipe não aceita convite; a senha errada no convite e na entrada somam no mesmo limite; só quem registrou corrige a ocorrência, em 30 minutos, e a versão anterior fica em `valorAnterior`. | **O uso único na corrida não tem teste.** Tirar `usadoEm: null` da gravação do aceite não derruba nada: a checagem anterior recusa o convite usado, e só dois aceites ao mesmo tempo chegariam à gravação. O primeiro acesso tem esse teste; o convite, não.<br>**Quem tem o link do convite pode aceitá-lo**, como no primeiro acesso: o convite passa pela mão da família, e a tela 17 mostra a ela quem aceitou.<br>A ocorrência da escola entra como evento preliminar, mas a clínica ainda não a lê pela API: os avisos da escola ficam para depois de 19/10, e a tela 19 diz que o registro foi guardado, e não que a terapeuta foi avisada. |
| **A evolução da sessão: escrita pelo profissional, lida só pela clínica** (item 7, parte 1; Resolução CFP 001/2009; regras 3, 4 e 6) | `servidor/src/clinica/servico-sessoes-clinicas.ts`: encerrar exige a evolução (`erroDaEvolucao`, do compartilhado) e a grava como veio; só quem conduz encerra. Migração `evolucao_da_sessao`: a coluna e o CHECK `sessao_evolucao_so_encerrada` — preenchida, e não em branco, se e somente se a sessão está encerrada —, com `NOT VALID`, para não inventar evolução nas sessões que o primeiro ensaio encerrou antes dela. A trilha diz que a evolução foi escrita, e não o que ela diz. O registro ABC na sessão volta à versão publicada: só quem conduz, só com a sessão em andamento, e com a leitura clínica de quem registrou. | `test/sessao.test.ts`, num banco vazio e com a família e a escola de verdade: aberta, a sessão não tem evolução; sem evolução, em branco, de outro tipo ou longa demais, o encerramento é recusado e a sessão continua aberta; só quem conduz encerra; o texto volta como foi escrito, e nenhum registro da trilha o contém; a equipe e a coordenação o leem no histórico, e o profissional de fora é negado e registrado; a família e a escola são recusadas nas rotas de sessão, e nenhuma resposta delas contém a evolução; o banco recusa evolução em sessão aberta e sessão encerrada sem ela. A ocorrência na sessão: só quem conduz, ABC completo, leitura clínica de quem registrou, na ficha e fora dos avisos, com o paciente na trilha. | **O “nunca pré-preenchido” na tela é construção, sem teste:** o campo abre vazio, e o front não tem teste de componente.<br>As sessões encerradas antes da migração continuam sem evolução, e o histórico diz isso; saem quando o banco for zerado. |
| **Editar objetivo e datas, só em rascunho ou devolvido, com a versão anterior do que mudou** (item 7, parte 2; regras 4 e 6) | `servidor/src/clinica/servico-planos.ts`: `editarObjetivo` (as duas redações e o critério; o domínio fica) e `editarDatas`, com o plano em `RASCUNHO` ou `DEVOLVIDO` (`planoEditavel`, do compartilhado); a redação acessível continua obrigatória (`validarNovoObjetivo`). O `valorAnterior` é o JSON canônico só dos campos que mudaram (`anterioresQueMudaram`); sem mudança, nada se grava e o interceptador não registra. | `test/edicao-plano.test.ts`: mudar só a redação acessível deixa na trilha só ela, com o paciente; mudar o critério, só o percentual; sem mudança, nenhum registro novo; redação acessível em branco e critério fora da faixa são recusados; o profissional de fora é negado e registrado, e o responsável nem chega à rota; as datas guardam só a anterior que mudou, e revisão antes do início é recusada; em validação e vigente, nada se edita, e devolvido volta a editar. `compartilhado/src/dominio/auditoria.test.ts`: os campos que mudaram e os nomes deles na trilha. | **A trilha de volta e o “continua na mesma tela” são do front, sem teste de componente.** Conferidos no navegador: cada passo da trilha é link; o Voltar e o Avançar do navegador percorrem lista, ficha e plano; salvar o objetivo ou as datas deixa a tela onde estava, com o foco no botão que abriu a edição. |
| **Duas contas no mesmo navegador: a janela diz que a conta mudou** (item 7, parte 3) | `src/servicos/api/cliente.ts`: toda resposta 401 ou 403 fora de `/auth/` avisa o ouvinte. `src/contexto/Sessao.tsx`: o ouvinte relê a sessão atual, uma vez só para várias negativas ao mesmo tempo, e `mudancaDaSessao` compara com o que a janela mostra. `src/app/AvisoDeJanela.tsx`: outra conta, outro perfil ou conta que saiu viram um aviso por cima de qualquer tela, com o foco nele e o botão de recarregar. | `src/contexto/mudancaDaSessao.test.ts`: a mesma conta e o mesmo perfil não mudam nada; outra conta dá o nome dela; outro perfil e a conta que saiu também aparecem; o cliente avisa no 401 e no 403, e o erro continua chegando à tela; a negativa de entrar e os outros erros não avisam. | **O aviso na tela é do front, sem teste de componente.** Conferido no navegador, com duas abas: a terapeuta numa, a mãe entra na outra, e a ficha aberta na primeira mostra *"Esta janela agora está com a conta de Patrícia Ficticia"*; recarregar leva ao painel da família.<br>Não é segurança: quem recusa é o servidor. O aviso só impede que a recusa pareça defeito. |
| **Nenhuma tela diz “terapeuta”: a pessoa aparece pelo nome e pela especialidade** (item 7, parte 4) | `src/app/perfis.ts`: o perfil `TERAPEUTA` aparece como “Profissional da clínica”; `comEspecialidade` e `papelNaTela` mostram “Ana Souza · Psicologia”. A sessão (`SessaoUsuario.especialidade`), a lista de pacientes e a fila de planos trazem a especialidade do servidor. `servidor/src/usuarios/servico-usuarios.ts`: convidar com o perfil de profissional da clínica exige a especialidade. O enum continua `TERAPEUTA` no código e no banco. | `src/publicacao.test.ts`: o pacote publicado não tem “terapeuta” nem “Terapeuta”, e tem “Profissional da clínica”. `test/usuarios.test.ts`: sem especialidade, o profissional da clínica é recusado, e a coordenação passa sem ela; a sessão leva a especialidade. `test/edicao-plano.test.ts`: a lista de pacientes e a fila de planos trazem a especialidade de quem responde e de quem escreveu. | **O teste confere o pacote, e não cada tela.** Uma tela que componha a palavra em pedaços passaria; o texto montado de dados também — o nome de uma pessoa cadastrada como “Ana Terapeuta” aparece como foi escrito.<br>O texto do termo de consentimento não tem a palavra; se tivesse, mudar exigiria versão nova. |
| **Editar o responsável: o e-mail só enquanto o primeiro acesso está pendente** (item 8, parte 1; regras 1 e 6) | `servidor/src/clinica/servico-pacientes.ts`, `editarResponsavel`: só a equipe do paciente e a coordenação (`exigirPacienteClinico`). Nome, telefone e parentesco mudam a qualquer momento. O e-mail vai para minúsculas, é único, nunca é o de uma conta da equipe ou da escola, e só muda enquanto a pessoa não definiu a senha — conferido antes e de novo na própria gravação (`ultimoAcessoEm: null` no filtro). Quem responde legalmente não se edita: o pedido que tenta mudar é recusado. O `valorAnterior` é o JSON canônico só do que mudou; sem mudança, nada se grava e nada se registra. | `test/responsavel.test.ts`: o e-mail digitado errado se corrige, e a trilha guarda o e-mail e o telefone anteriores, com o paciente; o link já entregue continua valendo, com o e-mail corrigido; sem mudança, nenhum registro; e-mail da equipe, da escola, de outra pessoa ou inválido, e dado faltando, são recusados; mudar quem responde legalmente é recusado; o profissional de fora é negado e registrado com o paciente, e o responsável nem chega à rota; depois da senha definida, trocar o e-mail é recusado, e a pessoa continua entrando com ele; nome, telefone e parentesco continuam editáveis, pela coordenação também, e a trilha guarda só eles. | **Quem responde legalmente não se edita: é limite declarado em 18/10, e não regra provada.** Uma resposta errada no cadastro fica como está: não há, no sistema, como corrigi-la.<br>O nome e o telefone são da pessoa: editados numa ficha, mudam em todas as fichas em que ela está.<br>As duas barreiras do e-mail se cobrem: tirar só a conferência não derruba teste nenhum (quebra abaixo), e a corrida entre definir a senha e editar o e-mail não tem teste. |
| **O link para nova senha do responsável: só a coordenação, com motivo, e o aviso no acesso seguinte** (item 8, parte 2; decisão de 18/10, que muda a de 16/10; regras 1 e 6) | `servidor/src/clinica/servico-pacientes.ts`, `linkNovaSenhaDoResponsavel`: só a coordenação — a rota tem `@Perfis('COORDENADOR')`, e o serviço confere de novo —, só para quem já definiu a senha, e com motivo (`erroDoMotivoDaNovaSenha`, do compartilhado), que vai para a trilha com quem gerou; o token, nunca. Enquanto o primeiro acesso está pendente, o link continua sendo o de primeiro acesso, com a equipe. O link é o mesmo `acesso_inicial` (migração `link_de_nova_senha`): 72 horas, uso único na própria gravação, só o resumo SHA-256, agora com `finalidade` e `geradoPorId`, e CHECKs que exigem o autor no link de nova senha e só ali. Usado, troca a senha e apaga todas as sessões da pessoa. `servidor/src/autenticacao/servico-autenticacao.ts`: a sessão leva o `avisoDeRedefinicao` — quando, e a pedido de quem — até a pessoa dar ciência (`POST /api/auth/aviso-de-nova-senha`), e `src/app/LayoutApp.tsx` o mostra acima de qualquer tela. | `test/responsavel.test.ts`: o profissional da equipe é negado, mesmo com motivo, e a negativa fica na trilha com o paciente; ele também não gera mais o link de primeiro acesso; sem motivo, só com espaços, de outro tipo ou longo demais, a coordenação é recusada e nenhum link nasce; para quem ainda não definiu a senha, este link é recusado; com motivo, o link vale 72 horas, o banco guarda só o resumo e quem gerou, e a trilha tem a coordenação, o perfil, o paciente e o motivo, sem o token; usado, as duas sessões abertas antes deixam de valer, a senha antiga é recusada e o link não vale de novo; a entrada e a sessão seguintes trazem o aviso com o instante e o nome da coordenação, até a ciência, e não depois; o primeiro acesso não traz aviso, e a ciência sem sessão é recusada; o banco recusa link de nova senha sem autor, primeiro acesso com autor e ciência antes do uso. `src/app/textoDaRedefinicao.test.ts`: o texto do aviso, com a data e a hora de Manaus. | **Quem gera o link poderia usá-lo.** É a mesma fragilidade do primeiro acesso, sem e-mail: a separação de funções, o motivo na trilha e o aviso diminuem o risco, e não o tiram. Se a coordenação usar o link, quem vê o aviso é ela mesma; o responsável descobre porque a senha dele deixa de entrar.<br>**O professor recupera a senha pela administração** desde o item 13, com a mesma regra (abaixo).<br>O aviso na tela é do front, sem teste de componente; conferido no navegador.<br>As duas barreiras da coordenação se cobrem: tirar só a marca da rota, ou só a conferência do serviço, não derruba teste nenhum (quebras abaixo). |
| **Uma conta por aba: cada aba resolve a sessão só pelo cookie da vaga dela** (item 9; `docs/07`, D5, revisto em 24/10) | `servidor/src/autenticacao/servico-sessoes.ts`: cinco vagas, `sinctea_sessao_1` a `sinctea_sessao_5`, todas `httpOnly`, `Secure` e `SameSite=Lax`. `vagaLivre` dá a primeira vaga sem sessão que valha e recusa a sexta conta antes de conferir a senha e antes de gastar o link de primeiro acesso ou de nova senha, ou o convite. `resolver` lê só o cookie da vaga do cabeçalho `X-Sinctea-Aba` (de 1 a 5, e nada mais) e apaga o cookie antigo, `sinctea_sessao`, com a linha dele. `encerrar` apaga a sessão e o cookie só da vaga; `contasAbertas` devolve vaga, nome e perfil ativo das vagas que valem. `src/servicos/api/cliente.ts`: a aba guarda só o número da vaga em `sessionStorage` e o manda em toda chamada; o token não sai do cookie. | `test/vagas.test.ts`, com um navegador que guarda e apaga cookies como o de verdade: três contas, cada aba com a sua, e cada uma alcançando só o que é dela; a resposta de entrar não traz o token; sem o cabeçalho, ou com valor fora de 1 a 5, não há sessão, mesmo com todos os cookies; vaga sem cookie não tem sessão e não toma a de outra; a sexta conta é recusada com a mensagem, sem sessão nova, mesmo com senha errada, e a vaga liberada volta a ser a primeira livre; sair numa vaga não derruba a outra, nem da mesma conta; trocar de perfil vale só para a vaga; desativar encerra a conta em todas as vagas, e só ela; a lista de contas abertas traz só vaga, nome e perfil ativo — sem token, resumo ou e-mail — e deixa de fora a sessão vencida e o cookie inventado; ler a lista não abre sessão; o primeiro acesso usa a primeira vaga livre, e com as cinco ocupadas é recusado sem gastar o link; o cookie antigo é apagado com a linha e não abre sessão. `src/servicos/api/vaga.test.ts`: o cabeçalho vai em toda chamada, e não vai sem vaga, com vaga fora da faixa ou sem `sessionStorage`; entrar guarda só o número; sair o esquece mesmo sem rede; continuar como uma conta usa a vaga dela, e a esquece se ela não vale mais. | **A vaga não é segredo, e não precisa ser.** Quem tem o navegador nas mãos escolhe a vaga e usa a conta aberta nela, como antes usava a única; o limite continua sendo o do computador compartilhado: sair ao terminar.<br>**A aba duplicada leva a mesma vaga.** Se uma delas sai ou troca de perfil, a outra descobre na chamada seguinte, pelo aviso do item 7.<br>A lista *Contas abertas neste navegador* e a etiqueta *✓ Já definiu a senha* são do front, sem teste de componente; conferidas no navegador, com três abas ao mesmo tempo. |
| **Objetivo novo só em rascunho ou devolvido; a escola só vê o registro que a família autorizou** (item 10, divergências do `docs/03`; UC17; regras 2 e 4) | `servidor/src/clinica/servico-planos.ts`: `adicionarObjetivo` passa pela mesma recusa da edição (`exigirPlanoEditavel`), e o mock também: com o plano vigente ou na fila, o objetivo novo não entra sem a coordenação, e a família não lê a redação acessível dele antes da conferência. Na tela 6, "Adicionar objetivo" só aparece com o plano editável. `servidor/src/escola/servico-area-escola.ts`: o cartão da escola traz os escopos que a família deu, e a tela 18 só oferece "Registrar uma ocorrência" com o de registro. `src/app/familia/etiquetaDaAutorizacao.ts`: cada situação da autorização com a sua etiqueta, a que não começou como na ficha. | `test/edicao-plano.test.ts`: na fila e vigente, o objetivo novo é recusado com a mensagem da edição, e o plano fica com os objetivos que tinha, nem a coordenação acrescenta; devolvido, entra. `test/escola.test.ts`: o cartão traz só os escopos autorizados — o de Miguel, só o do cartão; o de Sofia, os dois. `src/servicos/mock/regrasInviolaveis.test.ts`: o mesmo no mock, e os testes da regra 4 passaram a escrever num plano novo, em rascunho. `src/app/familia/etiquetaDaAutorizacao.test.ts`: "Acesso ainda não começou", e uma etiqueta por situação. | **A conferência da situação e a gravação do objetivo não estão na mesma trava.** Se a coordenação aprovar o plano no mesmo instante em que o objetivo é gravado, ele entra; não há teste de corrida.<br>**Revisar o plano vigente continua sem caminho**: precisa de uma versão nova do plano, e está anotado como lacuna no `docs/03`.<br>Os textos da ficha (tela 5), o erro do envio (tela 6) e a frase da versão anterior (tela 19) são do front, sem teste de componente. A ficha e o erro do envio foram conferidos no navegador; as telas 17, 18 e 19, não, porque o banco local não tem autorização que ainda não começou nem acesso da escola vigente. |
| **O administrador nunca alcança dado clínico, nem pelo texto da auditoria; o link para nova senha da equipe e do professor é dele, com motivo** (item 13; regras 1, 3 e 6) | `servidor/src/usuarios/servico-trilha.ts`: a trilha administrativa (`GET /api/admin/trilha`, só `@Perfis('ADMINISTRADOR')`) devolve só registro **sem paciente e** de uma entidade da lista fechada `ENTIDADES_ADMINISTRATIVAS`, do compartilhado — `Usuario`, `Profissional`, `Escola` e `RegistroAuditoria`. As duas condições juntas: há registro clínico sem paciente (a leitura da lista de pacientes, a fila de planos, os avisos da escola, a lista de alunos) e há entidade da lista que, noutra rota, leva paciente (o link do responsável, item 8). A projeção é explícita, sem `ipOrigem` nem `pacienteId`; vinte por página, do mais recente; filtros de período nos dias de Manaus, de pessoa e de ação, validados antes do banco; nenhuma rota edita, apaga ou exporta. Uma conferência defensiva recusa a página se aparecer entidade fora da lista. Ler a trilha é `LEITURA_AUTORIZADA` de `RegistroAuditoria`, sem paciente, e a negativa de quem não é administrador fica nela pela mesma entidade. `servidor/src/usuarios/servico-usuarios.ts`: `linkNovaSenha`, só do administrador, para a equipe e o professor ativos que já definiram a senha, com motivo (`erroDoMotivoDaNovaSenha`) na trilha, com quem gerou; o mesmo `acesso_inicial` do item 8, com `finalidade` e `geradoPorId`. O do responsável é negado: é da coordenação, na ficha. `novoLinkDeAcesso`, o de primeiro acesso, sem motivo, passa a valer só enquanto a pessoa não definiu a senha. Usado o link, a trilha diz quem o gerou (`geradoPor.nome`). No mock, a exportação da coordenação recortada por paciente passa a levar o `pacienteId`: sem ele, o id do paciente iria para a trilha administrativa pelo texto. | `test/administracao.test.ts`, com registros clínicos no banco — o paciente, a ficha, a lista, o responsável, o link de nova senha dele pela coordenação e as negativas do administrador na ficha e na lista: a trilha inteira, página por página, não tem nenhum registro com paciente, nenhuma entidade fora da lista, nem `pacienteId`, `ipOrigem`, o nome ou o id do paciente, e tem todo registro sem paciente da lista; coordenação, profissional, responsável e professor recebem 403, e a negativa fica na trilha como `RegistroAuditoria`, sem paciente; sem sessão, 401; a leitura entra na trilha, com o total, e aparece na consulta seguinte; vinte por página, do mais recente, sem perder registro entre as páginas; os filtros de pessoa, ação e período; filtro inválido é 422, e pessoa que não é uuid, 404; `PUT`, `PATCH` e `DELETE` não existem; nenhum registro de todo o banco tem `$argon2`, resumo, hexadecimal de 64 caracteres ou qualquer dos tokens gerados. O link: o do responsável é negado ao administrador, a negativa fica na trilha e nenhum link nasce; coordenação, profissional e professor são negados; sem motivo, vazio, só com espaços, de outro tipo ou com 501 caracteres, 422; quem não definiu a senha e a conta desativada, 409; a equipe que já entrou não recebe mais o link de primeiro acesso. **Do professor e da equipe**, cada um: 72 horas, só o resumo e quem gerou no banco, motivo na trilha sem o token; antes do uso, a senha antiga vale; usado, as duas sessões abertas antes caem, a senha antiga é recusada e o link não vale de novo; a trilha diz *Senha redefinida pelo link de nova senha que Zélia Administradora gerou*; o uso, a entrada e a sessão seguintes trazem o aviso com o nome da administração, até a ciência. `src/servicos/mock/regrasInviolaveis.test.ts`: as mesmas recusas no mock, e a trilha administrativa do mock sem paciente, nem pelo texto da exportação recortada. | **A conferência defensiva não tem teste que a derrube sozinha:** a consulta já recorta, e tirá-la não muda nada (quebra abaixo). Ela só serve se a consulta mudar e esquecer o recorte.<br>**A lista vale pelo que se grava hoje.** Uma entidade da lista com texto de paciente e sem `pacienteId` passaria; o comentário de `ENTIDADES_ADMINISTRATIVAS` exige gravar o paciente junto em todo recorte por paciente, e o teste só cobre o que as rotas de hoje gravam.<br>**`valorAnterior` vazio:** nenhuma alteração de conta o preenchia, e a coluna *O que mudou* mostrava “—”. Resolvido no item 13b, abaixo, para perfis, situação e dados profissionais; os links continuam sem, porque não há campo de conta que mude.<br>**Quem gera o link poderia usá-lo**, como no item 8; o motivo, quem gerou e o aviso diminuem o risco, e não o tiram.<br>A tela 25 e o formulário do motivo são do front, sem teste de componente; conferidos no navegador com dados de teste locais. |
| **O que mudou na conta vai para a trilha; a escola cadastrada pela família sai sem o nome dela** (item 13b; regras 3 e 6) | `servidor/src/usuarios/servico-usuarios.ts`: `alterarPerfis`, `desativar`, `reativar` e `atualizarMeusDadosProfissionais` devolvem, com o resultado, a versão anterior só dos campos que mudaram, em JSON canônico (`ComAnterior`), e o controlador a entrega ao interceptador (`comAnterior`). Os perfis comparam como conjunto (`perfisQueMudaram`, do compartilhado): a mesma lista em outra ordem não é mudança. Nada mudou: nulo. Só quatro campos chegam lá — `perfis`, `ativo`, `especialidade` e `registroConselho` —, nunca a senha nem token. `servidor/src/usuarios/servico-trilha.ts`: o registro de `Escola` feito por um responsável (`semNomeNaTrilhaAdministrativa`) sai sem `usuarioId` e sem `usuarioNome`, e o filtro por pessoa não o alcança, porque pelo id a tela 14 diria o nome; a tela 25 mostra “Um responsável”. O banco continua com o nome. `compartilhado/src/dominio/auditoria.ts`: a lista sai separada por vírgula, o booleano como “Sim” ou “Não”, o vazio como “Em branco”, e a tela 25 dá aos perfis o nome de gente. O mock faz o mesmo. | `test/administracao.test.ts`: os perfis de antes, se o conjunto mudou, e nulo na mesma lista em outra ordem, e a trilha administrativa o mostra; desativar guarda `{"ativo":true}`, reativar `{"ativo":false}`; o dono muda a especialidade, depois o registro, e cada vez só o campo que mudou fica, e nada na terceira, sem mudança; toda versão anterior de conta no banco só tem os quatro campos, e nenhuma tem `$argon2`, senha ou token; a escola cadastrada pela mãe tem o nome dela no banco e, na trilha administrativa, `usuarioId` e `usuarioNome` nulos, sem o nome nem o id em lugar nenhum do item, e o filtro pela mãe traz os registros da conta dela, com o nome, e nenhum de escola. `compartilhado/src/dominio/auditoria.test.ts`: o conjunto dos perfis, a leitura de lista, sim ou não e em branco, e o predicado da escola. `src/servicos/mock/regrasInviolaveis.test.ts`: perfis e situação com o valor anterior, e a escola cadastrada pelo responsável sem o nome nem no filtro. | **O registro dos dados profissionais continuava como `Usuario`** (“Conta”, na tela 25): passou ao `Profissional` no item 13c, abaixo.<br>**A regra da escola vale pela entidade e pelo perfil.** Se outro registro, de outra entidade, ligar uma família a algo que o administrador não precisa saber, ele aparece com o nome. Hoje, sem paciente e na lista, o responsável só aparece na escola, na própria conta e nas próprias negativas.<br>**Nada mudou, e a trilha registrava mesmo assim:** nos perfis e nos dados profissionais, deixou de registrar no item 13c, abaixo. |
| **A troca de perfis com nome de tela; os dados profissionais no Profissional; sem mudança, sem registro** (item 13c; regra 6) | `compartilhado/src/dominio/perfis.ts`: `NOME_DO_PERFIL` saiu do front para o domínio, e `detalheDosPerfis` grava *"Perfis: Coordenador clínico, Profissional da clínica"*; a tela 25 mostra o detalhe como foi gravado, sem traduzir. Os registros de antes de 26/10 ficam com o nome interno. `servidor/src/usuarios/controlador-usuarios.ts`: o `PUT /usuarios/eu/dados-profissionais` registra na entidade `Profissional`, que já está em `ENTIDADES_ADMINISTRATIVAS`. `servidor/src/usuarios/servico-usuarios.ts`: sem mudança, `alterarPerfis` e `atualizarMeusDadosProfissionais` não escrevem, e o controlador dispensa o registro (`comAnterior`, com a edição), como nas edições da clínica. O mock faz o mesmo. | `test/administracao.test.ts`: a troca de perfis grava os nomes de tela, sem nenhum nome interno, e a tela 25 recebe o detalhe igual; a mudança de especialidade fica no `Profissional`, sem paciente, com a versão anterior, e aparece na trilha administrativa; salvar os mesmos perfis em outra ordem e os mesmos dados profissionais, com espaços em volta, não deixa registro nenhum, e a linha do banco continua igual. `test/usuarios.test.ts`: a alteração dos dados profissionais está no `Profissional`. `compartilhado/src/dominio/perfis.test.ts`: o detalhe na ordem recebida e nenhum nome de tela com "terapeuta". `src/servicos/mock/regrasInviolaveis.test.ts`: os três pontos no mock. | **Gravar os mesmos dados profissionais de novo não deixa rastro** (quebra abaixo): a tabela não tem data de atualização, e o registro já é dispensado pelo controlador.<br>**Só a edição deixa de registrar sem mudança.** Desativar a conta já desativada, ou reativar a ativa, continua gerando `ALTERACAO`, com o valor anterior nulo; a tela 14 só oferece cada ação no estado em que ela muda algo. |
| **Atividades de casa: a clínica que alcança o paciente prescreve e encerra; a família vinculada vê e registra, uma vez por dia; escola e administração nunca** (item 15; UC07 e UC14; regras 3, 4 e 6) | `servidor/src/atividades/servico-atividades.ts`: prescrever e encerrar passam por `exigirPacienteClinico` — a equipe do paciente ou a coordenação; ver a atividade, a lista e as execuções e registrar como foi, por `exigirPacienteDaFamilia` — qualquer responsável vinculado, legal ou não. Professor e administrador caem no alcance clínico, que os nega, e as rotas de `controlador-atividades.ts` já os recusam por `@Perfis`. O objetivo tem de ser do plano `VIGENTE` do paciente, o mesmo recorte que a família lê na tela 15; que a atividade e o objetivo são do mesmo paciente, o *trigger* `atividade_casa_mesmo_paciente` (migração `caminhos_coerentes`) já garantia no banco. A validação é `validarNovaAtividadeCasa`, do compartilhado, a mesma da tela 9 e do mock: título até 120 caracteres, descrição e dicas até 1.000, de 1 a 10 passos de até 300, frequência de 1 a 7, e o vídeo só `https://`, até 500 (`ehEnderecoDeVideo`); a observação da família, até 500 (`erroDaObservacaoDaFamilia`). Um registro por atividade por dia, no dia civil de Manaus: o índice único `(atividadeId, dataRealizacao)`, da migração `execucao_uma_por_dia`, recusa o segundo, e a recusa diz quem registrou; conferir que a atividade está ativa e gravar vão na mesma transação, com `FOR SHARE` na linha da atividade, e o encerramento que chega junto espera. Para a família, a lista sai só com as ativas, seja qual for o filtro; a encerrada ainda se abre pelo endereço, com o histórico. A resposta leva o objetivo só pelo id; desde o item 15b, também a redação acessível (linha abaixo). Na trilha: `LEITURA_AUTORIZADA`, com o paciente, em listar, obter e listar execuções; `CRIACAO` em prescrever e em registrar; `ALTERACAO` em encerrar; a observação da família não entra. `src/componentes/CartaoAtividadeFamilia.tsx`: o vídeo vira o link "Ver o vídeo", em nova aba, com `rel="noopener noreferrer"`, só se `ehEnderecoDeVideo`. O mock faz o mesmo, menos a trilha. | `test/atividades.test.ts`: a criação com o objetivo vigente, ativa, sem o passo vazio, com uma linha na trilha e o paciente; o objetivo do plano em rascunho, o vigente de outro paciente, o id inventado e o ausente são 422, e nada se grava; o vídeo `javascript:` e `http:`, onze passos, título de 121 caracteres e frequência 8 ou em texto são 422; o profissional fora da equipe é negado nas cinco rotas, o responsável de outro paciente nas quatro da família, a família ao prescrever e ao encerrar, e o professor do próprio aluno e o administrador nas seis — cada negativa deixa uma linha `ACESSO_NEGADO`, com o paciente onde a rota ou o serviço o conhece; a mãe e o pai leem a lista e a atividade, uma linha por leitura, sem a redação técnica nem o domínio; o pai, que não é legal, registra, no dia de Manaus, com uma linha `CRIACAO` sem a observação; o segundo registro do dia é 409, *Hoje já foi registrado por Paulo Ficticio.*, sem linha nova; quatro pedidos ao mesmo tempo dão um registro e uma linha; às 22h30 de Manaus, com o relógio fixo, o registro fica no dia de Manaus; com a linha da atividade presa por um encerramento em curso, o registro espera e é recusado com *Esta atividade foi encerrada pela equipe.*; desempenho fora dos três e observação de 501 caracteres são 422; encerrar é uma linha `ALTERACAO`, encerrar de novo é 409, a encerrada some da lista da família com qualquer filtro e segue na da clínica, e o registro nela é 409, com as palavras da tela 16; no banco, o índice recusa o segundo registro do dia e o *trigger* recusa o objetivo de outro paciente. `compartilhado/src/dominio/regras.test.ts`: cada limite, um acima; `javascript:`, `data:`, `http:` e endereço sem servidor. `src/componentes/CartaoAtividadeFamilia.test.tsx`: o link com `target` e `rel`, e nenhum link sem `https://`. `src/servicos/mock/regrasInviolaveis.test.ts`: o plano vigente, um registro por dia e a lista da família no mock. | **A marca da rota e o alcance do serviço se cobrem:** tirar só o `@Perfis` não derruba teste nenhum (quebra abaixo), porque o serviço nega de novo.<br>**O mock não registra a família na trilha**, nem as leituras: é o achado 2, e o mock sai na Etapa 12.<br>**O dia vem do relógio do servidor.** O teste fixa o relógio às 22h30 de Manaus; um servidor com o relógio errado gravaria o dia errado.<br>As telas 9, 15 e 16 são do front, sem teste de componente além do cartão; conferidas no navegador com dados de teste locais. |
| **Para que serve e quem registrou; o registro de hoje na tela 16; os limites da atividade no banco** (item 15b; UC07 e UC14; regras 3, 4 e 6) | `servidor/src/clinica/mapeadores.ts`: `OBJETIVO_DA_ATIVIDADE` busca do objetivo só a `descricaoAcessivel`, e `paraAtividade` a põe em `paraQue`, em todas as rotas de `servico-atividades.ts`; a redação técnica nem chega ao mapeador. `QUEM_REGISTROU` lê o nome do usuário a cada leitura, e `paraExecucao` o põe em `responsavelNome`: a execução não guarda cópia. O mock faz o mesmo na resposta (`comParaQue` e `comQuemRegistrou`, em `src/servicos/mock/familia.ts`). `src/componentes/CartaoAtividadeFamilia.tsx`: "Para que serve" logo abaixo do título, no cartão que é o mesmo da tela 16 e da prévia da tela 9. `src/app/familia/registroDeHoje.ts`: `lugarDoRegistro` decide o que fica no lugar do "Como foi hoje?" — a encerrada primeiro; depois o registro de hoje, no dia de Manaus (`diaCivilEm`), com *Você já registrou hoje.* ou *Hoje já foi registrado por {nome}.*; senão, o formulário — e `quemRegistrou` dá o nome no histórico só quando foi outro responsável; a tela 16 só os mostra. Quem decide o registro continua sendo o índice único. A migração `atividade_limites`: `atividade_casa_frequencia_semanal_faixa` (1 a 7), `atividade_casa_passos_faixa` (1 a 10, no lugar de `atividade_casa_passos_nao_vazio`), `atividade_casa_url_video_https` (nulo, ou começando com `https://`, em minúsculas, com até 500), `atividade_casa_titulo_tamanho` (1 a 120), `atividade_casa_descricao_tamanho` e `atividade_casa_dicas_tamanho` (até 1.000) e `execucao_atividade_casa_observacao_tamanho` (até 500); e o índice só de `atividadeId` sai, porque o único `(atividadeId, dataRealizacao)` começa por ele. `ehEnderecoDeVideo` deixou de aceitar `HTTPS://` em maiúsculas, como o CHECK. | `test/atividades.test.ts`: a atividade prescrita, a lista da clínica e da família, a obtida e a encerrada trazem o `paraQue` igual à redação acessível, e nada do que a família recebe — a lista, a atividade, o registro, o histórico e a encerrada — contém a redação técnica nem o domínio; o registro e o histórico, para a equipe, a coordenação, a mãe e o pai, dizem quem registrou, e o nome corrigido na rede de apoio aparece na leitura seguinte e na recusa do segundo registro. `test/checks.test.ts`, por INSERT em SQL, por fora do domínio: frequência 0 e 8; passos vazios, nulos e onze; vídeo `javascript:`, `http:`, `HTTPS://` e de 501 caracteres; título vazio e de 121; descrição e dicas de 1.001; observação de 501 — cada um recusado pelo nome do CHECK, e o valor no limite passa —; e os índices da execução são só o único e a chave primária. `src/app/familia/registroDeHoje.test.ts`: sem registro de hoje, com o da própria pessoa, com o de outro responsável, às 22h30 de Manaus, a encerrada antes do registro de hoje, e o nome no histórico. `src/componentes/CartaoAtividadeFamilia.test.tsx`: "Para que serve" depois do título e antes da frequência e da descrição, e nada dele sem redação. `compartilhado/src/dominio/regras.test.ts`: `HTTPS://` recusado. `src/servicos/mock/regrasInviolaveis.test.ts`: o `paraQue`, a redação técnica fora e o nome de quem registrou no mock. | **O banco não confere os 300 caracteres de cada passo:** CHECK não percorre o array sem função própria; o domínio confere.<br>**O "já registrado hoje" usa o relógio do aparelho**, no calendário de Manaus. Com o relógio errado, a tela mostra o formulário quando não devia, ou o esconde; quem decide continua sendo o índice único.<br>**A marcação das telas 9 e 16 não tem teste de componente:** tirar o nome do histórico da tela 9, ou mostrar o formulário fora do `lugarDoRegistro`, não derruba teste nenhum (quebras abaixo). A decisão está nas funções testadas, e as duas telas foram conferidas no navegador com dados de teste locais. |
| **O relato da escola chega à clínica, e a leitura clínica é do profissional** (`docs/07`, seção 0, item 6; regras 3 e 6) | `servidor/src/clinica/servico-ocorrencias.ts`: os eventos da ficha passam por `exigirPacienteClinico`; os avisos, pelo mesmo `alcancaClinicamente`, de `alcance.ts`; só o evento da escola ainda sem leitura, registrado nos últimos sete dias. A leitura clínica confere o alcance, recusa o evento já lido e grava com a condição `leituraClinicaEm: null`, para que dois pedidos ao mesmo tempo não gravem duas. As três rotas declaram a auditoria. | `test/ocorrencias.test.ts`, num banco que começa vazio e com o caminho inteiro pelas rotas: o relato do professor aparece como aviso para a equipe e a coordenação, e não para o terapeuta de fora; na ficha, como evento preliminar com a origem; fora da equipe, a ficha e a leitura negam e a negativa fica com o paciente; professor e responsável são recusados nas três rotas; a leitura sai da lista de avisos e fica na ficha; a segunda leitura é conflito; quatro pedidos ao mesmo tempo gravam uma leitura e um registro; o aviso vale por sete dias; encerrado o acesso da escola, o relato continua na clínica. | **A lista de avisos atravessa pacientes**, e a trilha guarda quantos avisos saíram, sem dizer de quem — como a lista de pacientes.<br>**Duas barreiras na leitura, e cada uma sozinha segura a outra:** tirar a conferência do evento já lido não derruba teste nenhum, porque a trava da gravação recusa; tirar a trava só derruba o teste de corrida.<br>O registro de ocorrência na sessão continua fora do caminho principal. |
| **A versão publicada fala só com a API, e o mock não vai junto** (`docs/07`, seção 0, item 5) | `src/servicos/index.ts`: no build de produção, só a API, no `/api` do mesmo endereço. `vite.config.ts`, plugin `semMockNoPacote`: no build, o `./mock` vira um módulo vazio. `src/app/caminhoPrincipal.ts`: as telas fora do caminho principal saem das rotas e do menu, e as seções que dependem delas saem da ficha, da sessão, do painel da família e da fila de planos. A entrada de demonstração só existe com o mock. O servidor manda `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` e `X-Frame-Options: DENY` em toda resposta, antes dos arquivos do front. | `src/publicacao.test.ts` roda o próprio build de produção e confere o pacote: fala com `/api`; não tem a senha de demonstração nem os personagens da semente; não tem a entrada de demonstração, a vitrine, nem um texto próprio de cada tela escondida; tem o aviso do ambiente. `servidor/test/front.test.ts`: os três cabeçalhos no `index.html`, num arquivo do front, na API e no 404, e sem `X-Powered-By`. | **O teste confere o pacote pelo texto.** Uma tela escondida que não tenha nenhum dos textos procurados passaria; a rota ausente se confere no navegador.<br>Os nomes do menu das telas escondidas continuam no pacote, filtrados em tempo de execução: o teste procura textos de dentro das telas, e não do menu.<br>O aviso do ambiente é conferido no pacote, e não em cada lugar onde aparece. |
| **Zerar o banco depois do ensaio, sem perder o papel** (`docs/07`, seção 0) | `servidor/src/comandos/zerar.ts`: recusa se quem conecta é o papel da aplicação ou não é o dono das tabelas; apaga e recria o esquema `public`; aplica as migrações; devolve ao papel os `GRANT` e o `ALTER DEFAULT PRIVILEGES` lidos do próprio `papel-aplicacao.exemplo.sql`, sem recriar o papel. A conferência do B3 (`conferirPapel`) roda como o papel e só lê; as duas tentativas são desfeitas. | `test/zerar.test.ts`: o papel nasce do modelo e grava dado e auditoria, como no ensaio; com a URL do papel, o zerar recusa e nada sai; com a do dono, o esquema volta com as 25 tabelas, as migrações versionadas e nenhum registro — nem a auditoria; o papel, com a mesma senha, passa na conferência e volta a gravar; a tabela de uma migração futura chega a ele; a conferência aponta o banco com uma migração a menos. | **O teste roda com um dono superusuário; no Neon, o dono não é.** O `DROP SCHEMA` pelo dono do banco é o que o próprio `prisma migrate reset` faz no Neon, mas o zerar ainda não rodou lá.<br>A conferência rodou no Neon em 17/10, como o `sinctea_app`, e passou inteira. |
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
| O perfil volta a se chamar “Terapeuta” | 1 |
| Um texto da escola volta a dizer “terapeuta” | 1 |
| Convidar sem exigir a especialidade | 1 |
| A sessão sem a especialidade | 1 |
| A lista de pacientes sem a especialidade | 1 |
| O cliente não avisa a negativa | 1 |
| O cliente avisa também a negativa de entrar | 1 |
| A comparação ignora o perfil | 1 |
| Trocar o e-mail do responsável sem conferir antes o primeiro acesso, com a trava da gravação | **0**: a trava da gravação recusa, com a mesma mensagem |
| Trocar o e-mail do responsável sem a conferência e sem a trava | 2: *o e-mail já é o login* e, por arrasto, o seguinte, que achou o e-mail trocado |
| Editar o responsável com o registro inteiro no `valorAnterior` | 2 |
| Editar o responsável sem recusar o e-mail da equipe ou da escola | 1: o e-mail cai na recusa de outra pessoa, com a mensagem errada |
| Aceitar mudar quem responde legalmente | 2: *quem responde legalmente não se edita* e, por arrasto, o seguinte: o pedido recusado regravou o telefone |
| Editar o responsável sem o `valorAnterior` na trilha | 3 |
| Editar o responsável sem o alcance clínico | 2: o profissional de fora e, por arrasto, o nome que ele trocou |
| Editar o responsável sem o e-mail em minúsculas | 3: o CHECK do banco recusa a maiúscula |
| O link para nova senha sem `@Perfis('COORDENADOR')` na rota | **0**: o serviço confere de novo e recusa, com o paciente na trilha |
| O link para nova senha sem a conferência da coordenação no serviço | **0**: a rota recusa antes |
| O link para nova senha sem as duas | 2: *a equipe não gera* e, por arrasto, o seguinte, que achou o link que a terapeuta gerou |
| O link para nova senha sem exigir o motivo | 1 |
| A trilha sem o motivo | 1 |
| O link para nova senha sem quem o gerou | 3: o CHECK do banco recusa a gravação, e o uso e o aviso caem por arrasto |
| Usar o link não encerra as sessões | 1: *as duas sessões abertas antes deixam de valer* |
| A sessão sem o aviso | 1 |
| A ciência do aviso não fica gravada | 1 |
| O link para nova senha para quem ainda não definiu a senha | 2: *este link é recusado* e, por arrasto, o primeiro acesso do pai, cujo link o novo invalidou |
| A equipe gera link de primeiro acesso depois da senha definida | 2: o teste do item 3 e o deste item |
| A migração sem o CHECK do autor do link | 1 |
| A migração sem o CHECK da ciência depois do uso | 1 |
| O aviso sem dizer a pedido de quem | 1 |
| O aviso com a hora em UTC, e não a de Manaus | 1 |
| Sem o cabeçalho da aba, a sessão cai na vaga 1 | 2: *sem o cabeçalho, não há sessão* e *ler a lista não abre sessão* |
| Toda sessão abre na vaga 1 | 8 |
| Sem o limite de cinco: a sexta conta toma a última vaga | 2: a sexta conta e o link de primeiro acesso com as cinco ocupadas |
| Sair encerra todas as sessões da conta | 1: *sair numa vaga não derruba a outra* |
| Sair apaga o cookie de todas as vagas | 2: *sair numa vaga não derruba a outra* e a vaga liberada, que deixou de ser a primeira livre |
| A lista de contas abertas com o e-mail | 1 |
| A lista de contas abertas com a sessão vencida | 1. **Passou na primeira vez:** o teste só tinha um cookie inventado, que já fica de fora por não ter linha no banco. Entrou uma sessão de verdade, vencida |
| O cookie antigo fica | 1 |
| Entrar confere a senha antes de ver se há vaga | 1: a sexta conta com senha errada recebe 401, e não a recusa das vagas |
| O primeiro acesso gasta o link antes de ver se há vaga | 1: *com as cinco ocupadas, o link continua valendo* |
| Trocar de perfil vale para todas as sessões da conta | 1 |
| O front não manda o cabeçalho da aba | 2 |
| Entrar não guarda a vaga | 1 |
| Sair só esquece a vaga se o servidor responder | 1 |
| O servidor acrescenta objetivo em qualquer situação do plano | 1: *em validação, nada se edita; devolvido, volta a editar; vigente, nunca mais* |
| O mock acrescenta objetivo em qualquer situação do plano | 1 |
| O cartão da escola sem os escopos | 2: o cartão projetado e o de Sofia, com os dois escopos |
| O cartão da escola com todos os escopos, autorizados ou não | 1: o de Miguel, que só tem o do cartão |
| A autorização que não começou volta a dizer "Prazo terminado" | 2: a etiqueta dela e a de uma etiqueta por situação |
| A trilha administrativa sem o recorte de paciente | 1: *o administrador não recebe nenhum registro com paciente* — o link do responsável, que é `Usuario`, aparece |
| A trilha administrativa sem a lista de entidades | 5: a conferência defensiva recusa a página, e toda leitura da trilha cai |
| Só a conferência defensiva fora | **0**: a consulta já recorta |
| O IP na resposta da trilha | 1 |
| A coordenação também lê a trilha administrativa | 1: *quem não é administrador recebe a recusa* |
| Ler a trilha sem entrar na trilha | 3: a leitura, a paginação, que lê até haver mais de duas páginas, e o filtro de período, que conta a leitura |
| A trilha do mais antigo para o mais recente | 2 |
| A administração gera o link de nova senha do responsável | 1 |
| O link de nova senha da administração sem exigir o motivo | 1 |
| O link da administração sem quem o gerou | 2: o do professor e o da equipe, que viram primeiro acesso, sem aviso |
| O link de primeiro acesso, sem motivo, para a equipe que já definiu a senha | 1 |
| O link de nova senha para quem ainda não definiu a senha | 1 |
| A trilha do uso sem o nome de quem gerou o link | 3: o do professor, o da equipe e, por arrasto, a recusa da trilha, que usa a sessão nova da profissional |
| Mock: a exportação recortada por paciente sem o paciente | 1: o id do paciente aparece na trilha administrativa pelo texto |
| Mock: a trilha administrativa sem o recorte de paciente | 1 |
| Perfis sem o valor anterior | 1 |
| Perfis comparados pela ordem | 1, no compartilhado |
| Desativar sem o valor anterior | 2: a situação e, por arrasto, a contagem das versões anteriores de conta |
| Reativar sem o valor anterior | 1 |
| Dados profissionais sem o valor anterior | 2: o do dono e a contagem |
| Dados profissionais com o registro inteiro no valor anterior | 1 |
| O `senhaHash` na versão anterior da desativação | 3: a situação, a dos quatro campos e a de nenhuma senha na trilha |
| A escola da família com o nome na trilha administrativa | 1 |
| O filtro por pessoa traz a escola da família | 1 |
| Mock: a escola da família com o nome | 1 |
| Mock: perfis sem o valor anterior | 1 |
| O detalhe da troca de perfis com o nome interno | 1 |
| Os dados profissionais na entidade `Usuario` | 1 |
| O controlador registra a edição sem mudança | 2: a de perfis em outra ordem, do 13b, e a sem mudança, do 13c |
| Os perfis se gravam mesmo sem mudança | 1: a linha do banco muda de ordem |
| Os dados profissionais se gravam mesmo sem mudança | **0**: os mesmos valores não deixam rastro, e o registro já é dispensado |
| Domínio: o detalhe com o nome interno | 1, no compartilhado |
| Mock: o detalhe com o nome interno | 1 |
| Mock: os dados profissionais na entidade `Usuario` | 2: o do 13c e o do relatório, que confere o registro do conselho |
| Mock: perfis registrados sem mudança | 1 |
| Mock: dados profissionais registrados sem mudança | 1 |
| Atividade com objetivo de plano que não é vigente | 1 |
| Atividade com objetivo de outro paciente | 1: o *trigger* do banco ainda recusa, mas com erro 500, e não com o campo |
| O vídeo sem a validação do compartilhado | 2: o `javascript:` passa e, por arrasto, a lista da família, que ganha uma atividade a mais |
| A migração com índice comum, e não único | 5: o segundo registro, os quatro ao mesmo tempo, o índice no banco e, por arrasto, os dois do encerramento |
| O registro sem conferir que a atividade está ativa | 2: a atividade encerrada e o encerramento que chega junto |
| A lista da família segue o filtro pedido | 1 |
| Encerrar sem o alcance clínico | 7: o profissional de fora encerra, e os seguintes, por arrasto |
| A leitura da clínica sem o alcance | 1 |
| O registro sem o vínculo familiar | 3 |
| `GET /atividades/:id` sem `@Perfis` | **0**: o alcance clínico do serviço nega professor e administrador de novo |
| `GET /atividades/:id` sem `@Perfis` e sem o alcance clínico | 2 |
| O registro da família sem linha na trilha | 2 |
| O registro da família na trilha sem o paciente | 2 |
| Encerrar sem a condição na gravação | 1 |
| O dia do registro em UTC, e não em Manaus | 1. **Passou na primeira vez:** eram 16h40 em Manaus, e os dois dias coincidiam. O teste com o relógio fixo às 22h30 entrou |
| A observação da família sem limite | 1 |
| O desempenho sem conferência | 1: o banco recusa o valor fora do enum, mas com erro 500 |
| A leitura da família sem linha na trilha | 1 |
| O registro sem `FOR SHARE` na linha da atividade | 1. **Passou na primeira vez:** nenhum teste segurava a linha. O teste do encerramento em curso entrou, e derrubou a quebra nas três vezes em que ela rodou |
| O cartão vira link sem conferir o `https://` | 1 |
| O link do vídeo sem `rel` | 1 |
| Mock: a lista da família segue o filtro | 1 |
| Mock: dois registros no mesmo dia | 1 |
| Mock: objetivo de plano que não é vigente | 1 |
| O bloco da tela 15 de novo fora da versão publicada | 1: *leva as atividades de casa do item 15* |
| O `paraQue` com a redação técnica | 2: o do item 15, sem nada clínico para a família, e o do 15b |
| O objetivo inteiro na resposta, ao lado do `paraQue` | 2: os mesmos |
| O `paraQue` vazio | 1 |
| A lista sem o objetivo (uma rota sem o `paraQue`) | 3: a lista quebra com erro 500, e os testes que a leem caem juntos |
| O nome de quem lê, e não de quem registrou | 2 |
| O nome guardado na primeira leitura, como cópia | 1: o nome corrigido na rede de apoio não aparece |
| Sem o CHECK da frequência | 1 |
| Os passos sem o teto de 10 | 1 |
| O CHECK antigo dos passos mantido, sem o novo | 1: a recusa vem com o nome antigo, e o onze passa |
| O vídeo sem exigir `https://` | 1 |
| O vídeo sem o limite de 500 | 1 |
| O vídeo sem diferenciar maiúsculas | 1 |
| O título sem o mínimo | 1 |
| O título sem o máximo | 1 |
| Sem o CHECK da descrição | 1 |
| Sem o CHECK das dicas | 1 |
| Sem o CHECK da observação | 1 |
| O índice só de `atividadeId` mantido | 1 |
| Domínio: `HTTPS://` em maiúsculas aceito | 1, no compartilhado |
| Mock: o `paraQue` com a redação técnica | 1 |
| Mock: sem o nome de quem registrou | 1 |
| O registro de hoje no dia UTC | 1: às 22h30 de Manaus |
| Sempre *Você já registrou hoje.* | 2 |
| Qualquer registro conta como de hoje | 2 |
| O formulário mesmo com registro de hoje | 1 |
| O registro de hoje antes da encerrada | 1 |
| O nome sempre no histórico da tela 16 | 1 |
| O cartão sem "Para que serve" | 1 |
| "Para que serve" depois da descrição | 1 |
| A tela 9 sem quem registrou | **0**: a marcação da tela não tem teste de componente; conferida no navegador |
| A tela 16 mostra o formulário fora do `lugarDoRegistro` | **0**: idem; a decisão está em `lugarDoRegistro`, testada |
| Editar objetivo em qualquer situação do plano | 1 |
| Editar as datas em qualquer situação do plano | 1 |
| A edição sem a validação da regra 4 | 1 |
| O registro inteiro no `valorAnterior` | 3 |
| Sem mudança, a edição entra na trilha mesmo assim | 1 |
| A edição sem o `valorAnterior` na trilha | 3 |
| Encerrar sem exigir a evolução | 1: o banco ainda recusa, pelo CHECK, mas com erro 500, e não com o motivo |
| A migração sem o CHECK da evolução | 1 |
| A evolução copiada para a trilha | 1 |
| A evolução fora da resposta | 2 |
| A ocorrência na sessão sem exigir quem conduz | 1 |
| A ocorrência na sessão como evento preliminar | 1 |
| A ocorrência na sessão sem o paciente na trilha | 1 |
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
| Zerar sem devolver os privilégios ao papel | 2: a conferência e a tabela futura |
| Zerar sem conferir quem é o dono | 1: o papel chega ao `DROP SCHEMA`, recusado pelo banco com outra mensagem |
| Os privilégios sem o `ALTER DEFAULT PRIVILEGES` | 2 |
| A conferência sem comparar as migrações | 1. **Passou na primeira vez:** nenhum teste tinha um banco atrasado. O teste entrou |
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
