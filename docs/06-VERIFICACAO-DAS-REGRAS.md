# 06 · Verificação das seis regras invioláveis

Lido no código em 12/10/2026, sobre o commit `f88d0f3` — não na memória, nem nos
outros documentos. Os números de linha valem para esse commit.

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
(173 testes) rodou, e a quebra foi desfeita. O teste só aparece na tabela se
falhou. As quebras e o que cada uma derrubou estão na seção 4. Quando uma
quebra **não** derrubou teste nenhum, isso está na quarta coluna — é o caso
mais importante do documento.

---

## 2. A tabela

Toda regra é aplicada na camada de serviços (`src/servicos/mock`) ou no módulo
de domínio que ela chama (`src/dominio/regras.ts`). **Nenhuma das seis está
aplicada só na interface.** O que existe só na interface é uma afirmação sobre a
regra 1, registrada como achado na seção 3.

| Regra | Onde é aplicada (arquivo e função) | Teste que falha se for violada | O que esse teste não prova |
|---|---|---|---|
| **1 · Quem autoriza a escola é o Responsável; convite de uso único, 72 h; sem autocadastro** | `consentimentosMock.conceder` (`mock/familia.ts:241`): `exigirPerfil(['RESPONSAVEL'])` e `exigirPacienteDaFamilia` antes de tudo.<br>`convitesMock.aceitar` (`mock/familia.ts:372`): `situacaoConvite` antes de criar a conta; `usadoEm` gravado no aceite (`:412`).<br>`calcularExpiracaoConvite` e `VALIDADE_CONVITE_HORAS` (`dominio/regras.ts:275`, `:18`).<br>`usuariosMock.convidar` (`mock/gestao.ts:114`): só `PERFIS_DE_EQUIPE` (`:91`). | *professor nao concede consentimento* · *terapeuta tambem nao concede*<br>*responsavel concede e recebe convite de uso unico com 72 horas* · *expira 72 horas depois de criado*<br>*os quatro estados do convite*<br>*o administrador nao cria professor nem responsavel por esta tela* | **"Não existe autocadastro" é construção, não teste.** Nenhuma operação além de `convites.aceitar` cria `ProfessorAEE`; uma operação nova que criasse não seria acusada.<br>Coordenador e administrador não são testados em `conceder`: ficam de fora pela mesma lista de perfis, por construção.<br>**O serviço aceita a concessão de qualquer responsável vinculado, inclusive com `responsavelLegal = false`.** Ver achado 1. |
| **2 · Nenhum dado atravessa sem consentimento vigente e escopo, verificados a cada leitura** | `exigirAcessoEscola` (`mock/escola.ts:36`), primeira linha de `obterCartao`, `registrarOcorrencia` e `corrigirOcorrencia`.<br>Regra pura: `verificarAcessoEscola` (`dominio/regras.ts:244`) sobre `situacaoConsentimento` (`:218`).<br>Roda dentro de `responder` (`mock/infra.ts:39`), depois da latência: o consentimento é relido na hora da resposta. | *verificarAcessoEscola (UC21)* — os cinco casos, um por motivo<br>*escopo so de cartao nao permite registrar ocorrencia*<br>*a leitura seguinte a revogacao ja e negada e auditada* · *revogacao feita durante a latencia de uma leitura ja vale para ela* | **A regra é aplicada por chamada, não por estrutura.** Uma operação nova da escola que esqueça `exigirAcessoEscola` não é acusada. Tirar a verificação de `obterCartao` só foi pego pelos testes da regra 5, não pelos da regra 2.<br>No serviço não há teste de `SEM_CONSENTIMENTO` (professor pedindo o cartão de aluno sem vínculo), nem de `EXPIRADO` ou `AGUARDANDO_INICIO`. Esses motivos estão provados só na função pura.<br>`listarAlunos` não passa pela verificação, de propósito. Ver achado 3. |
| **3 · A escola nunca acessa evolução, plano, diagnóstico, laudo ou histórico de sessões** | Tipo `CartaoEscola` (`servicos/tipos.ts:707`) e projeção campo a campo em `obterCartao` (`mock/escola.ts:122`).<br>Contrato `ServicoAreaEscola` (`contratos.ts:141`): quatro operações, nenhuma clínica.<br>Nos demais serviços, `alcancaClinicamente` (`mock/acesso.ts:205`) devolve `false` para `PROFESSOR`, e as listas de `exigirPerfil` não o incluem. | *o cartao nao carrega nenhum campo clinico*<br>*professor nao alcanca nenhum servico clinico, e a tentativa e auditada*<br>*a escola nunca alcanca o relatorio, e a tentativa fica auditada*<br>*so quem alcanca o paciente confirma dominio ou registra leitura* | **O teste do cartão é uma lista de proibidos** (oito termos). Um campo clínico novo com outro nome — `hipotese`, `cid` — passaria.<br>**O tipo protege menos do que parece:** o compilador recusa `nivelSuporte` escrito direto no objeto (TS2353), mas aceita o mesmo campo vindo por *spread*. Conferido com `tsc`.<br>Nos testes, o professor só chama três serviços clínicos, o relatório, `confirmarDominio`, `registrarLeituraClinica` e o painel da coordenação. Os outros ficam fechados por construção, pelos mesmos `exigirPacienteClinico` e `exigirPerfil`. |
| **4 · Duas redações; a acessível é escrita pelo terapeuta, nunca gerada** | `validarNovoObjetivo` (`dominio/regras.ts:132`) recusa a acessível vazia.<br>`planosMock.adicionarObjetivo` (`mock/clinica.ts:56`) grava `dados.descricaoAcessivel.trim()`. É a única escrita do campo no código.<br>Projeções: `familia.listarObjetivos` (`mock/familia.ts:136`), `obterCartao` (`paraQue`), relatório por destinatário. | *objetivo sem descricao acessivel e recusado* · *recusa descricao acessivel vazia explicando por que o campo existe*<br>*a descricao acessivel e gravada como foi escrita*<br>*a familia recebe so a redacao acessivel* | **Os dois testes da regra provam a metade positiva:** a redação acessível é obrigatória na entrada e gravada como chegou. **Nenhum prova a metade negativa, "nunca gerada automaticamente".**<br>Um botão na tela 6 que preenchesse o campo a partir da redação técnica passou pelos 173 testes. O serviço recebe uma *string* e não tem como saber quem a escreveu.<br>Hoje vale por construção (não existe gerador, e não existe operação que altere a acessível depois de gravada) e por revisão de código. Nada impede que um gerador entre depois. |
| **5 · A revogação produz efeito imediato, sem cache que sobreviva a ela** | `consentimentosMock.revogar` (`mock/familia.ts:319`) grava `revogadoEm` no próprio consentimento.<br>`situacaoConsentimento` (`dominio/regras.ts:218`) testa a revogação antes de tudo, sem carência.<br>`exigirAcessoEscola` relê o consentimento a cada chamada.<br>No cliente de API, `cache: 'no-store'` (`api/cliente.ts:41`). | *revogacao tem efeito imediato, sem carencia*<br>*a leitura seguinte a revogacao ja e negada e auditada*<br>*revogacao feita durante a latencia de uma leitura ja vale para ela* | **A ausência de cache é estrutural — não há camada de cache —, mas a verificação vai um pouco além do que parece.** O teste lê o cartão *antes* de revogar. Um cache dentro do serviço, da decisão ou do cartão, seria aquecido por essa leitura e serviria a seguinte. A quebra com um `Map` de permissões derrubou o teste.<br>**Não é verificado nada fora do serviço:** o `no-store` do cliente de API (stub, sem teste); um *service worker* (não existe ainda; quando o PWA offline entrar, a leitura da escola precisa ficar fora do cache em tempo de execução); e o que já está na tela. A revogação vale para a próxima leitura, e um cartão aberto continua aberto até o professor sair dele. |
| **6 · Auditoria em três momentos; registro imutável** | `auditar` (`mock/infra.ts:143`): `Object.freeze` em cada registro, acrescentado ao fim da trilha.<br>`negar` (`mock/infra.ts:167`) audita toda negativa de perfil ou alcance; `exigirAcessoEscola` audita a negativa por consentimento (`mock/escola.ts:53`).<br>Concessão em `conceder` e `aceitar`. Leitura autorizada em `obterCartao`, `listarAlunos`, `pacientes.obter`, `planos.obterPorPaciente`, `sessoes.listarPorPaciente`, `ocorrencias.listarPorPaciente`, `familia.listarObjetivos`, `relatorios.obter`, `indicadores.listarAlertas` e `auditoria.exportar`.<br>Contrato `ServicoAuditoria` (`contratos.ts:150`): só `listar` e `exportar`. Tipo `RegistroAuditoria` com campos `readonly` (`servicos/tipos.ts:749`). | *registros sao congelados*<br>*o contrato de auditoria so tem leitura*<br>*a concessao fica auditada com o nome da escola*<br>*le o cartao com consentimento vigente, e a leitura e auditada*<br>*a ficha de paciente de outro profissional e negada ao terapeuta*, e outras três que conferem a negativa na trilha | **Imutável, mas só o registro, não a trilha.** Os campos são `readonly`, o que o TypeScript verifica em tempo de compilação. **Em tempo de execução também há algo:** `Object.freeze` em cada registro, e um teste confere. Só que `banco.auditoria` é um *array* comum. Remover um registro — a quebra apagou a concessão ao revogar — passou pelos 173 testes. Imutabilidade de verdade é permissão de banco, tabela só de inserção, e isso é do servidor.<br>**"Leitura autorizada de dado sensível" está provada caso a caso, não em geral.** O teste dos três momentos só confere que cada tipo aparece ao menos uma vez. Tirar a auditoria da leitura da ficha passou pelos 173.<br>**Há leituras de dado de saúde sem auditoria.** Ver achado 2.<br>Tentativa sem sessão (`NAO_AUTENTICADO`) não entra na trilha: não há quem registrar. |

### A mesma tabela, separada pelos três tipos de garantia

- **Provado por teste:** quem pode conceder, as 72 horas, o uso único do
  convite, a administração não criar professor; o escopo e a revogação na
  leitura da escola; o cartão sem os oito termos proibidos e o professor negado
  nos serviços que os testes chamam; a redação acessível obrigatória e gravada
  como foi escrita; a leitura seguinte à revogação negada, mesmo com cache
  dentro do serviço; o registro congelado, o contrato da trilha só de leitura e
  a concessão, a leitura do cartão e a negativa auditadas.
- **Garantido por construção:** não haver autocadastro de professor; não haver
  gerador nem edição da redação acessível; não haver camada de cache; a escola
  ter só as quatro operações do seu contrato; não haver operação que apague ou
  altere registro da trilha.
- **Convenção de front-end:** o `no-store` do cliente de API; nenhum botão gerar
  a redação acessível na tela 6; e, até o servidor existir, todas as linhas
  acima. É o que diz a seção 6.

---

## 3. Achados

Nenhum deles foi corrigido neste commit. Cada um pede uma decisão que não é de
implementação.

### Achado 1 — a restrição ao responsável legal só existe na interface

A ficha do paciente (tela 5) marca cada responsável como "Responsável legal" ou
"Não responde legalmente". O comentário do componente explica o porquê
(`src/app/clinica/Ficha.tsx:22`): *só o responsável legal autoriza o acesso da
escola (regra 1 do CLAUDE.md)*.

**O serviço não verifica isso.** `conceder` chama `exigirPacienteDaFamilia`, que
aceita qualquer `VinculoFamiliar` do paciente, sem olhar `responsavelLegal`.
Conferido com uma sonda descartada depois: Gustavo Ferrer, pai de Noah e com
`responsavelLegal = false` nos dados de demonstração, concedeu acesso à escola. O
consentimento nasceu `VIGENTE`, com convite.

A regra 1 do CLAUDE.md diz "o Responsável", sem "legal". O artigo 14, § 1º, da
LGPD fala em consentimento dado "por pelo menos um dos pais ou pelo responsável
legal". Há duas saídas, e a escolha é do Cowork:

- **Se só o responsável legal concede:** a verificação entra em `conceder`, com
  um teste que use o vínculo de Gustavo.
- **Se qualquer responsável vinculado concede:** o comentário da ficha está
  errado, e o atributo `responsavelLegal` precisa de outra justificativa no
  modelo.

### Achado 2 — leituras de dado de saúde sem registro de auditoria

Nenhum documento define "dado sensível" para a regra 6: nem o CLAUDE.md, nem a
tela 13 em `docs/03`. Na prática, a lista de leituras auditadas foi crescendo
tela a tela. Estas leituras devolvem dado de um paciente identificado e **não**
deixam rastro:

| Operação | O que devolve |
|---|---|
| `sessoes.obter` | Os registros de uma sessão, tentativa por tentativa |
| `relatorios.previsualizar` | O conteúdo inteiro de um relatório de evolução |
| `relatorios.listarPorPaciente` | Os relatórios emitidos de um paciente |
| `atividades.listarPorPaciente`, `obter`, `listarExecucoes` | O que foi prescrito para casa e o que a família registrou |
| `consentimentos.listarPorPaciente` | Quais escolas têm acesso, e até quando |
| `ocorrencias.listarAvisosDaEscola` | Eventos da escola ainda sem leitura clínica, com o nome do paciente |

Outras leituras sem auditoria são listas ou agregados: `pacientes.listar`,
`sessoes.listarAgenda`, `listarPendentesDeSincronizacao`,
`familia.listarFilhos` e os indicadores `resumo`, `sessoesPorProfissional` e
`ponteEscola`. A listagem da trilha também não é auditada, de propósito, com o
motivo escrito em `mock/gestao.ts:45`.

**A decisão é o que conta como dado sensível.** Com a definição escrita, a
correção é mecânica: um `auditar` em cada operação da lista e um teste que
percorra todas.

### Achado 3 — a lista de alunos não passa pela verificação de consentimento

`listarAlunos` (`mock/escola.ts:72`) devolve, de quem já concedeu algum dia, o
primeiro nome, a turma, o turno, a escola e a situação, **inclusive depois da
revogação**. Os escopos saem vazios quando não há vigência (`:99`).

A razão está no código e no passo 27 do diagrama de sequência: a linha que some
sem explicação faz o professor supor defeito. São dados que o próprio professor
declarou ao aceitar o convite ou viu nele, e nenhum é clínico. Mesmo assim, a
regra 2 diz "nenhum dado". A exceção precisa estar escrita onde a regra está,
para não parecer descuido na banca.

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
| `negar` sem auditoria | 4 |
| Concessão registrada como `CRIACAO` | 1 |
| Revogar apaga a concessão da trilha | **0** |
| Leitura da ficha sem auditoria | **0** |

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
