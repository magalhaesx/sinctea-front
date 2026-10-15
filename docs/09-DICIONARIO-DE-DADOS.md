# 09 · Dicionário de dados

Gerado em 15/10/2026 do catálogo do PostgreSQL 17, depois das três migrações do repositório (`20261015022852_inicial`, `20261015031253_caminhos_coerentes`, `20261015034333_chaves_compostas_sem_cascata`). **Não se edita à mão:** muda o esquema, gera de novo.

O significado de cada coluna está escrito a partir de `compartilhado/src/tipos.ts`, do `schema.prisma` e das regras do `CLAUDE.md`. O tipo, a nulidade, as chaves, as restrições, os índices e os gatilhos saem do próprio banco. O DER está em `docs/uml/SINCTEA_DER.svg` (todas as colunas) e `docs/uml/SINCTEA_DER_chaves.svg` (só as chaves).

## 1. Convenções

- Tabela em `snake_case`; coluna com o nome de `tipos.ts`, em `camelCase`.
- `uuid` gerado na aplicação (UUID v7). `timestamptz(3)` para instante; `date` para data civil, que trafega como `"AAAA-MM-DD"` e não passa por fuso.
- `[]` é array do PostgreSQL; os atributos `[1..*]` do diagrama têm CHECK de ao menos um elemento.
- **Fotografia:** coluna que guarda o valor de um momento, sem chave estrangeira, para sobreviver à mudança do original (`usuarioNome`, `autorNome`, `objetivoIds`).
- **Chave composta:** quando o mesmo paciente é alcançável por dois caminhos, uma chave estrangeira composta obriga os dois a concordarem; quando o caminho tem mais de um passo, um gatilho faz o mesmo.
- Ações de chave estrangeira: *restringe* recusa a operação enquanto houver quem aponte; *cascata* propaga a mudança.

**Totais:** 22 tabelas, 158 colunas, 36 chaves estrangeiras (5 compostas), 11 CHECKs, 10 gatilhos, 13 enumerações.

## 2. Enumerações

| Enumeração | Valores |
|---|---|
| `acao_auditoria` | `CONCESSAO_ACESSO` consentimento concedido · `REVOGACAO_ACESSO` consentimento revogado · `LEITURA_AUTORIZADA` leitura com consentimento vigente · `ACESSO_NEGADO` tentativa recusada · `CRIACAO` registro criado · `ALTERACAO` registro alterado |
| `desempenho` | `SOZINHO` fez sozinho · `COM_AJUDA` fez com ajuda · `NAO_QUIS` não quis fazer |
| `destinatario` | `PROFISSIONAIS` a equipe · `FAMILIA` a família |
| `escopo_acesso` | `CARTAO_ESTRATEGIA` ver o cartão de estratégias · `REGISTRO_OCORRENCIA` registrar ocorrência |
| `origem` | `CLINICA` na clínica · `CASA` em casa · `ESCOLA` na escola |
| `origem_auditoria` | `CLINICA` área da clínica · `FAMILIA` área da família · `ESCOLA` área da escola · `SISTEMA` o próprio sistema |
| `perfil` | `TERAPEUTA` profissional que atende · `COORDENADOR` coordenação clínica · `ADMINISTRADOR` gestão de usuários · `RESPONSAVEL` familiar · `PROFESSOR` professor da escola |
| `resultado` | `INDEPENDENTE` sem ajuda · `AJUDA_GESTUAL` com dica de gesto · `AJUDA_FISICA` com ajuda física · `SEM_RESPOSTA` não respondeu |
| `situacao_plano` | `RASCUNHO` em elaboração · `AGUARDANDO_VALIDACAO` enviado à coordenação · `DEVOLVIDO` voltou para ajuste · `VIGENTE` aprovado e em uso |
| `situacao_sessao` | `AGENDADA` marcada · `EM_ANDAMENTO` acontecendo · `PAUSADA` interrompida · `ENCERRADA` concluída · `CANCELADA` não aconteceu |
| `status_objetivo` | `NAO_INICIADO` ainda não trabalhado · `EM_AQUISICAO` em treino · `DOMINADO` domínio confirmado pelo profissional |
| `status_sync` | `PENDENTE` registrado sem conexão, ainda não subiu · `SINCRONIZADO` já está no servidor |
| `status_vinculo` | `ATIVO` no ano letivo corrente · `ENCERRADO` encerrado |

## 3. Tabelas

### 3.1 `usuario`

*Classe:* Usuario · *Área:* Identidade

Quem entra no sistema. Superclasse com autenticação única: profissional, responsável e professor herdam dela, cada um na sua tabela.

| Coluna | Tipo | Nulo | Chave | Descrição |
|---|---|---|---|---|
| `id` | uuid | não | PK | Identificador. |
| `nome` | text | não |  | Nome completo. |
| `email` | text | não | UK | E-mail de acesso. Único. |
| `senhaHash` | text | não |  | Resumo argon2id da senha. Nunca a senha, e nunca sai em resposta da API. |
| `perfis` | perfil[] | não (CHECK) |  | Perfis com que o usuário pode agir. Ao menos um. |
| `ativo` | boolean | não |  | Falso quando o usuário foi desativado. Usuário não se exclui: o histórico clínico precisa manter a autoria. |
| `ultimoAcessoEm` | timestamptz(3) | sim |  | Último acesso bem-sucedido. |

**Restrições e índices**

- Chave primária: (id)
- Única: (email)
- CHECK: perfis com ao menos um elemento

### 3.2 `profissional`

*Classe:* Profissional · *Área:* Clínica

Dados próprios do profissional da clínica. A chave é o próprio usuário.

| Coluna | Tipo | Nulo | Chave | Descrição |
|---|---|---|---|---|
| `usuarioId` | uuid | não | PK FK | O usuário que é este profissional. Chave primária e estrangeira. |
| `especialidade` | text | não |  | Área de atuação: Psicologia, Fonoaudiologia, Terapia Ocupacional… |
| `registroConselho` | text | não |  | Registro no conselho profissional. Sem ele, o profissional não emite documento clínico; só o próprio dono o preenche. |

**Restrições e índices**

- Chave primária: (usuarioId)
- Chave estrangeira: (usuarioId) → usuario(id); ao apagar: restringe; ao atualizar: cascata

### 3.3 `responsavel`

*Classe:* Responsavel · *Área:* Família

Dados próprios do familiar. A responsabilidade legal não fica aqui: é da relação com cada paciente (vinculo_familiar).

| Coluna | Tipo | Nulo | Chave | Descrição |
|---|---|---|---|---|
| `usuarioId` | uuid | não | PK FK | O usuário que é este responsável. Chave primária e estrangeira. |
| `telefone` | text | não |  | Telefone de contato. |

**Restrições e índices**

- Chave primária: (usuarioId)
- Chave estrangeira: (usuarioId) → usuario(id); ao apagar: restringe; ao atualizar: cascata

### 3.4 `professor_aee`

*Classe:* ProfessorAEE · *Área:* Escola

Professor que acompanha o aluno na escola. Sem atributo próprio: a conta só nasce de convite, e o que o distingue são os vínculos escolares.

| Coluna | Tipo | Nulo | Chave | Descrição |
|---|---|---|---|---|
| `usuarioId` | uuid | não | PK FK | O usuário que é este professor. Chave primária e estrangeira. |

**Restrições e índices**

- Chave primária: (usuarioId)
- Chave estrangeira: (usuarioId) → usuario(id); ao apagar: restringe; ao atualizar: cascata

### 3.5 `paciente`

*Classe:* Paciente · *Área:* Identidade

A pessoa com TEA acompanhada pela clínica.

| Coluna | Tipo | Nulo | Chave | Descrição |
|---|---|---|---|---|
| `id` | uuid | não | PK | Identificador. |
| `nome` | text | não |  | Nome completo. |
| `dataNascimento` | date | não |  | Data de nascimento, data civil. |
| `nivelSuporte` | integer | não |  | Nível de suporte (1 a 3). |
| `profissionalResponsavelId` | uuid | não | FK | Profissional responsável pelo caso. |
| `ativo` | boolean | não |  | Falso quando o acompanhamento foi encerrado. |

**Restrições e índices**

- Chave primária: (id)
- Chave estrangeira: (profissionalResponsavelId) → profissional(usuarioId); ao apagar: restringe; ao atualizar: cascata
- CHECK: nivelSuporte entre 1 e 3

### 3.6 `paciente_equipe`

*Classe:* associação "equipe" · *Área:* Clínica

Tabela de junção: os profissionais que formam a equipe multiprofissional de cada paciente (Paciente *–1..* Profissional).

| Coluna | Tipo | Nulo | Chave | Descrição |
|---|---|---|---|---|
| `pacienteId` | uuid | não | PK FK | O paciente. |
| `profissionalId` | uuid | não | PK FK | Um profissional da equipe dele. |

**Restrições e índices**

- Chave primária: (pacienteId, profissionalId)
- Chave estrangeira: (pacienteId) → paciente(id); ao apagar: restringe; ao atualizar: cascata
- Chave estrangeira: (profissionalId) → profissional(usuarioId); ao apagar: restringe; ao atualizar: cascata
- Índice: (profissionalId)

### 3.7 `vinculo_familiar`

*Classe:* VinculoFamiliar · *Área:* Família

Liga um responsável a um paciente. Parentesco e responsabilidade legal são da relação: a mesma pessoa pode ser responsável legal por um filho e não por outro.

| Coluna | Tipo | Nulo | Chave | Descrição |
|---|---|---|---|---|
| `id` | uuid | não | PK | Identificador. |
| `responsavelId` | uuid | não | FK | O familiar. |
| `pacienteId` | uuid | não | FK | O paciente. |
| `parentesco` | text | não |  | Parentesco declarado: mãe, pai, avó… |
| `responsavelLegal` | boolean | não |  | Verdadeiro quando este familiar é o responsável legal por este paciente. Só ele concede ou revoga o acesso da escola (regra 1). |

**Restrições e índices**

- Chave primária: (id)
- Chave estrangeira: (pacienteId) → paciente(id); ao apagar: restringe; ao atualizar: cascata
- Chave estrangeira: (responsavelId) → responsavel(usuarioId); ao apagar: restringe; ao atualizar: cascata
- Índice: (pacienteId)
- Índice: (responsavelId)

### 3.8 `plano_terapeutico`

*Classe:* PlanoTerapeutico · *Área:* Clínica

Plano Terapêutico Individual do paciente, com o ciclo de validação pela coordenação.

| Coluna | Tipo | Nulo | Chave | Descrição |
|---|---|---|---|---|
| `id` | uuid | não | PK | Identificador. |
| `pacienteId` | uuid | não | FK | O paciente. Não muda depois de criado. |
| `autorId` | uuid | não | FK | Profissional que elaborou o plano. |
| `status` | situacao_plano | não |  | Situação no ciclo de validação. |
| `dataInicio` | date | não |  | Início da vigência, data civil. |
| `dataRevisao` | date | não |  | Revisão prevista, data civil. |
| `ultimaRevisaoEm` | timestamptz(3) | sim |  | Quando o plano foi revisto pela última vez. |
| `observacaoValidacao` | text | sim |  | O motivo da coordenação ao devolver o plano para ajuste. |

**Restrições e índices**

- Chave primária: (id)
- Chave estrangeira: (autorId) → profissional(usuarioId); ao apagar: restringe; ao atualizar: cascata
- Chave estrangeira: (pacienteId) → paciente(id); ao apagar: restringe; ao atualizar: cascata
- Gatilho: plano_dono_fixo — Recusa trocar o paciente de um plano.
- Índice: (pacienteId)

### 3.9 `objetivo`

*Classe:* Objetivo + CriterioDominio · *Área:* Clínica

Objetivo do plano, com as duas redações gravadas separadamente (regra 4). CriterioDominio, objeto de valor sem identidade, vira as duas últimas colunas.

| Coluna | Tipo | Nulo | Chave | Descrição |
|---|---|---|---|---|
| `id` | uuid | não | PK | Identificador. |
| `planoId` | uuid | não | FK | O plano a que pertence. Não muda depois de criado. |
| `dominio` | text | não |  | Área do desenvolvimento: comunicação, regulação sensorial, autonomia… |
| `descricaoTecnica` | text | não |  | Redação para a equipe (regra 4). |
| `descricaoAcessivel` | text | não |  | Redação para a família e a escola, escrita pelo terapeuta, nunca gerada automaticamente (regra 4). |
| `status` | status_objetivo | não |  | Etapa do objetivo. DOMINADO só por confirmação do profissional, com o critério atingido. |
| `dominadoEm` | timestamptz(3) | sim |  | Quando o domínio foi confirmado. Preenchida se, e só se, o status é DOMINADO. |
| `percentualAtual` | numeric(5,2) | não |  | Desempenho atual, em percentual de acertos independentes. |
| `percentualMinimo` | integer | não |  | Critério de domínio: percentual mínimo de acertos (CriterioDominio). |
| `sessoesConsecutivas` | integer | não |  | Critério de domínio: em quantas sessões seguidas o percentual mínimo precisa se repetir (CriterioDominio). |

**Restrições e índices**

- Chave primária: (id)
- Chave estrangeira: (planoId) → plano_terapeutico(id); ao apagar: restringe; ao atualizar: cascata
- CHECK: percentualAtual entre 0 e 100
- CHECK: percentualMinimo entre 0 e 100
- Gatilho: objetivo_dono_fixo — Recusa trocar o plano de um objetivo.
- Índice: (planoId)

### 3.10 `sessao`

*Classe:* Sessao · *Área:* Clínica

Sessão terapêutica conduzida por um profissional.

| Coluna | Tipo | Nulo | Chave | Descrição |
|---|---|---|---|---|
| `id` | uuid | não | PK | Identificador. |
| `pacienteId` | uuid | não | FK | O paciente. Não muda depois de criada. |
| `profissionalId` | uuid | não | FK | Profissional que conduz a sessão. |
| `numero` | integer | não |  | Número da sessão na sequência do paciente. |
| `inicioPrevistoEm` | timestamptz(3) | não |  | Início agendado. |
| `inicio` | timestamptz(3) | sim |  | Início real. |
| `fim` | timestamptz(3) | sim |  | Fim real. |
| `local` | text | não |  | Onde aconteceu: sala, domicílio, escola. |
| `situacao` | situacao_sessao | não |  | Situação da sessão. |
| `statusSync` | status_sync | não |  | Se o registro feito sem conexão já subiu ao servidor. |

**Restrições e índices**

- Chave primária: (id)
- Chave estrangeira: (pacienteId) → paciente(id); ao apagar: restringe; ao atualizar: cascata
- Chave estrangeira: (profissionalId) → profissional(usuarioId); ao apagar: restringe; ao atualizar: cascata
- Única: (id, pacienteId)
- Gatilho: sessao_dono_fixo — Recusa trocar o paciente de uma sessão.
- Índice: (pacienteId)
- Índice: (profissionalId, inicioPrevistoEm)

### 3.11 `registro_atividade`

*Classe:* RegistroAtividade · *Área:* Clínica

Cada tentativa registrada durante a sessão, ligada a um objetivo do mesmo paciente. Composição: não existe sem a sessão.

| Coluna | Tipo | Nulo | Chave | Descrição |
|---|---|---|---|---|
| `id` | uuid | não | PK | Identificador. |
| `sessaoId` | uuid | não | FK | A sessão em que foi registrado. |
| `objetivoId` | uuid | não | FK | O objetivo trabalhado. Tem de ser do mesmo paciente da sessão. |
| `ordem` | integer | não |  | Número da tentativa dentro da sessão, a partir de 1. |
| `resultado` | resultado | não |  | Nível de ajuda de que a criança precisou. |
| `ocorridoEm` | timestamptz(3) | não |  | Quando a tentativa aconteceu. |

**Restrições e índices**

- Chave primária: (id)
- Chave estrangeira: (objetivoId) → objetivo(id); ao apagar: restringe; ao atualizar: cascata
- Chave estrangeira: (sessaoId) → sessao(id); ao apagar: restringe; ao atualizar: cascata
- Gatilho: registro_atividade_mesmo_paciente — Recusa registro cujo objetivo é de outro paciente que não o da sessão.
- Índice: (objetivoId)
- Índice: (sessaoId)

### 3.12 `ocorrencia_comportamental`

*Classe:* OcorrenciaComportamental · *Área:* Clínica

Registro ABC (antecedente, comportamento, consequência). Quando vem da escola, entra como evento comportamental preliminar, até a leitura clínica.

| Coluna | Tipo | Nulo | Chave | Descrição |
|---|---|---|---|---|
| `id` | uuid | não | PK | Identificador. |
| `pacienteId` | uuid | não | FK | O paciente. |
| `origem` | origem | não |  | Onde aconteceu: clínica, casa ou escola. |
| `ocorridaEm` | timestamptz(3) | não |  | Quando aconteceu. |
| `antecedente` | text | não |  | O que aconteceu antes (A). |
| `comportamento` | text | não |  | O comportamento observado (B). |
| `consequencia` | text | não |  | O que aconteceu depois (C). |
| `intensidade` | integer | não |  | Intensidade, de 1 a 5. |
| `leituraClinicaEm` | timestamptz(3) | sim |  | Quando o profissional habilitado fez a leitura clínica. Nula enquanto o evento é preliminar. |
| `sessaoId` | uuid | sim | FK | A sessão em que ocorreu, quando foi em sessão. Do mesmo paciente. |
| `ocorrenciaEscolarId` | uuid | sim | FK UK | A ocorrência da escola que a gerou («gera»), quando veio de lá. Do mesmo paciente, e no máximo uma por ocorrência escolar. |

**Restrições e índices**

- Chave primária: (id)
- Chave estrangeira — composta: (ocorrenciaEscolarId, pacienteId) → ocorrencia_escolar(id, pacienteId); ao apagar: restringe; ao atualizar: restringe
- Chave estrangeira: (pacienteId) → paciente(id); ao apagar: restringe; ao atualizar: cascata
- Chave estrangeira — composta: (sessaoId, pacienteId) → sessao(id, pacienteId); ao apagar: restringe; ao atualizar: restringe
- Única: (ocorrenciaEscolarId)
- Única: (ocorrenciaEscolarId, pacienteId)
- CHECK: intensidade entre 1 e 5
- Índice: (pacienteId, ocorridaEm)

### 3.13 `relatorio_evolucao`

*Classe:* RelatorioEvolucao · *Área:* Clínica

Documento clínico emitido. Guarda o conteúdo exatamente como saiu e o resumo criptográfico dele. Só cresce: não se altera nem se apaga.

| Coluna | Tipo | Nulo | Chave | Descrição |
|---|---|---|---|---|
| `id` | uuid | não | PK | Identificador. |
| `pacienteId` | uuid | não | FK | O paciente. |
| `objetivoIds` | uuid[] | não (CHECK) |  | Os objetivos abrangidos, como fotografia: sem chave estrangeira, mas conferidos na emissão (todos do mesmo paciente). Ao menos um. |
| `periodoInicio` | date | não |  | Início do período relatado, data civil. |
| `periodoFim` | date | não |  | Fim do período relatado, data civil. |
| `destinatario` | destinatario | não |  | Para quem o documento foi escrito: a equipe ou a família. |
| `consideracoes` | text | não |  | A leitura do profissional. Obrigatória, nunca gerada. |
| `autorNome` | text | não |  | Nome de quem emitiu, como era na emissão (fotografia, sem chave estrangeira). |
| `autorRegistro` | text | não |  | Registro no conselho de quem emitiu, como era na emissão. |
| `emitidoEm` | timestamptz(3) | não |  | Quando foi emitido. |
| `conteudoEmitido` | text | não |  | O conteúdo exatamente como saiu, em JSON canônico. Texto, nunca jsonb: o documento precisa sair igual. |
| `hashConteudo` | text | não |  | `sha256:<hex>` do conteúdo emitido. Prova que o documento não mudou. |

**Restrições e índices**

- Chave primária: (id)
- Chave estrangeira: (pacienteId) → paciente(id); ao apagar: restringe; ao atualizar: cascata
- CHECK: objetivoIds com ao menos um elemento
- Gatilho: relatorio_evolucao_imutavel — Recusa UPDATE e DELETE: o documento emitido não muda.
- Gatilho: relatorio_evolucao_mesmo_paciente — Na emissão, recusa objetivo inexistente ou de outro paciente.
- Gatilho: relatorio_evolucao_sem_truncate — Recusa TRUNCATE nos relatórios emitidos.
- Índice: (pacienteId, emitidoEm)

### 3.14 `atividade_casa`

*Classe:* AtividadeCasa · *Área:* Família

Atividade prescrita para casa, sempre ligada a um objetivo do plano do mesmo paciente.

| Coluna | Tipo | Nulo | Chave | Descrição |
|---|---|---|---|---|
| `id` | uuid | não | PK | Identificador. |
| `pacienteId` | uuid | não | FK | O paciente. |
| `objetivoId` | uuid | não | FK | O objetivo a que a atividade serve. Tem de ser do mesmo paciente. |
| `titulo` | text | não |  | Título, em linguagem da família. |
| `descricao` | text | não |  | O que fazer. |
| `passos` | text[] | não (CHECK) |  | Passo a passo, na ordem. Ao menos um. |
| `dicas` | text | não |  | O que ajuda quando não sai de primeira. |
| `frequenciaSemanal` | integer | não |  | Quantas vezes por semana. |
| `urlVideo` | text | sim |  | Vídeo de demonstração, quando houver. |
| `ativa` | boolean | não |  | Falso quando a prescrição foi encerrada. |
| `prescritaEm` | timestamptz(3) | não |  | Quando foi prescrita. |

**Restrições e índices**

- Chave primária: (id)
- Chave estrangeira: (objetivoId) → objetivo(id); ao apagar: restringe; ao atualizar: cascata
- Chave estrangeira: (pacienteId) → paciente(id); ao apagar: restringe; ao atualizar: cascata
- CHECK: passos com ao menos um elemento
- Gatilho: atividade_casa_mesmo_paciente — Recusa atividade cujo objetivo é de outro paciente.
- Índice: (pacienteId)

### 3.15 `execucao_atividade_casa`

*Classe:* ExecucaoAtividadeCasa · *Área:* Família

O registro da família de que a atividade foi feita, e como foi.

| Coluna | Tipo | Nulo | Chave | Descrição |
|---|---|---|---|---|
| `id` | uuid | não | PK | Identificador. |
| `atividadeId` | uuid | não | FK | A atividade feita. |
| `responsavelId` | uuid | não | FK | O familiar que registrou. |
| `dataRealizacao` | date | não |  | O dia em que foi feita, data civil. |
| `desempenho` | desempenho | não |  | Como foi: sozinho, com ajuda, ou não quis. |
| `observacao` | text | sim |  | Comentário livre da família. |

**Restrições e índices**

- Chave primária: (id)
- Chave estrangeira: (atividadeId) → atividade_casa(id); ao apagar: restringe; ao atualizar: cascata
- Chave estrangeira: (responsavelId) → responsavel(usuarioId); ao apagar: restringe; ao atualizar: cascata
- Índice: (atividadeId)

### 3.16 `escola`

*Classe:* Escola · *Área:* Escola

Instituição de ensino nomeada pela família no consentimento.

| Coluna | Tipo | Nulo | Chave | Descrição |
|---|---|---|---|---|
| `id` | uuid | não | PK | Identificador. |
| `nome` | text | não |  | Nome da escola. |
| `rede` | text | não |  | Rede de ensino: municipal, estadual, federal ou particular. |
| `municipio` | text | não |  | Município. |

**Restrições e índices**

- Chave primária: (id)

### 3.17 `consentimento`

*Classe:* Consentimento · *Área:* Família

Autorização do responsável legal para uma escola específica ver ou registrar dados do paciente, nos escopos escolhidos e até a data de validade. A situação (vigente, revogado, expirado) não é coluna: deriva das datas a cada leitura (regra 5).

| Coluna | Tipo | Nulo | Chave | Descrição |
|---|---|---|---|---|
| `id` | uuid | não | PK | Identificador. |
| `responsavelId` | uuid | não | FK | O responsável legal que concedeu (regra 1). |
| `pacienteId` | uuid | não | FK | O paciente. Não pode ser trocado enquanto houver vínculo escolar apontando para o consentimento. |
| `escolaId` | uuid | não | FK | A escola nomeada pela família. Outra escola exige outro consentimento. |
| `escopos` | escopo_acesso[] | não (CHECK) |  | O que a escola pode fazer: ver o cartão de estratégias e/ou registrar ocorrência. Ao menos um. |
| `concedidoEm` | timestamptz(3) | não |  | Quando foi concedido. |
| `validadeAte` | date | não |  | Último dia de validade, data civil: vale até a 00:00 do dia seguinte em Manaus. |
| `revogadoEm` | timestamptz(3) | sim |  | Quando foi revogado. Com efeito imediato (regra 5). |
| `hashTermo` | text | não |  | `sha256:<versão>:<hex>` do termo aceito: a versão do texto e o resumo dos campos que o compõem. Prova do consentimento (LGPD). |

**Restrições e índices**

- Chave primária: (id)
- Chave estrangeira: (escolaId) → escola(id); ao apagar: restringe; ao atualizar: cascata
- Chave estrangeira: (pacienteId) → paciente(id); ao apagar: restringe; ao atualizar: cascata
- Chave estrangeira: (responsavelId) → responsavel(usuarioId); ao apagar: restringe; ao atualizar: cascata
- Única: (id, pacienteId)
- CHECK: escopos com ao menos um elemento
- Índice: (pacienteId)

### 3.18 `convite_escolar`

*Classe:* ConviteEscolar · *Área:* Escola

Convite de uso único que a família entrega ao professor. Nasce do consentimento e expira em 72 horas. Não existe autocadastro de professor.

| Coluna | Tipo | Nulo | Chave | Descrição |
|---|---|---|---|---|
| `id` | uuid | não | PK | Identificador. |
| `consentimentoId` | uuid | não | FK | O consentimento de que nasceu. |
| `token` | text | não | UK | Código de uso único que vai no link entregue ao professor. Único. |
| `criadoEm` | timestamptz(3) | não |  | Quando foi emitido. |
| `expiraEm` | timestamptz(3) | não |  | Até quando pode ser aceito: 72 horas depois de emitido. |
| `usadoEm` | timestamptz(3) | sim |  | Quando foi aceito. Nulo enquanto não foi usado. |

**Restrições e índices**

- Chave primária: (id)
- Chave estrangeira: (consentimentoId) → consentimento(id); ao apagar: restringe; ao atualizar: cascata
- Única: (id, consentimentoId)
- Única: (token)
- Índice: (consentimentoId)

### 3.19 `vinculo_escolar`

*Classe:* VinculoEscolar · *Área:* Escola

Nasce do convite aceito e liga o professor ao aluno. Não é controle de acesso: quem autoriza cada leitura é o consentimento, consultado a cada vez.

| Coluna | Tipo | Nulo | Chave | Descrição |
|---|---|---|---|---|
| `id` | uuid | não | PK | Identificador. |
| `consentimentoId` | uuid | não | FK | O consentimento que autorizou. Tem de ser do mesmo paciente. |
| `conviteId` | uuid | não | FK UK | O convite aceito que criou o vínculo. Um convite gera no máximo um vínculo, e tem de ser do mesmo consentimento. |
| `pacienteId` | uuid | não | FK | O aluno. |
| `professorId` | uuid | não | FK | O professor. |
| `turma` | text | não |  | Turma, declarada pelo professor no aceite. |
| `turno` | text | não |  | Turno, declarado no aceite. |
| `atuacao` | text | não |  | Como o professor atua com este aluno: regente, AEE… |
| `status` | status_vinculo | não |  | Situação do vínculo no ano letivo. Não é controle de acesso. |

**Restrições e índices**

- Chave primária: (id)
- Chave estrangeira — composta: (consentimentoId, pacienteId) → consentimento(id, pacienteId); ao apagar: restringe; ao atualizar: restringe
- Chave estrangeira — composta: (conviteId, consentimentoId) → convite_escolar(id, consentimentoId); ao apagar: restringe; ao atualizar: restringe
- Chave estrangeira: (pacienteId) → paciente(id); ao apagar: restringe; ao atualizar: cascata
- Chave estrangeira: (professorId) → professor_aee(usuarioId); ao apagar: restringe; ao atualizar: cascata
- Única: (conviteId, consentimentoId)
- Única: (conviteId)
- Única: (id, pacienteId, professorId)
- Índice: (professorId, pacienteId)

### 3.20 `ocorrencia_escolar`

*Classe:* OcorrenciaEscolar · *Área:* Escola

O que o professor observou, em vocabulário não interpretativo. Só existe a partir de um vínculo escolar.

| Coluna | Tipo | Nulo | Chave | Descrição |
|---|---|---|---|---|
| `id` | uuid | não | PK | Identificador. |
| `vinculoId` | uuid | não | FK | O vínculo escolar sob o qual foi registrada. Tem de ser deste paciente e deste professor. |
| `pacienteId` | uuid | não | FK | O aluno. |
| `professorId` | uuid | não | FK | O professor que registrou. |
| `ocorridoEm` | timestamptz(3) | não |  | Quando aconteceu na escola. |
| `registradaEm` | timestamptz(3) | não |  | Quando foi registrada: é daqui que corre a janela de correção. |
| `corrigidaEm` | timestamptz(3) | sim |  | Quando foi corrigida, dentro da janela. O valor anterior fica na auditoria. |
| `tipo` | text | não |  | O que foi observado, entre opções fechadas, sem vocabulário interpretativo. |
| `intensidade` | integer | não |  | Intensidade, de 1 a 5. |
| `contexto` | text | não |  | Em que momento da rotina: entrada, recreio, troca de atividade… |

**Restrições e índices**

- Chave primária: (id)
- Chave estrangeira: (pacienteId) → paciente(id); ao apagar: restringe; ao atualizar: cascata
- Chave estrangeira: (professorId) → professor_aee(usuarioId); ao apagar: restringe; ao atualizar: cascata
- Chave estrangeira — composta: (vinculoId, pacienteId, professorId) → vinculo_escolar(id, pacienteId, professorId); ao apagar: restringe; ao atualizar: restringe
- Única: (id, pacienteId)
- CHECK: intensidade entre 1 e 5

### 3.21 `cartao_estrategia`

*Classe:* CartaoEstrategia · *Área:* Escola

Orientações práticas para a escola, ligadas a um objetivo. É o único conteúdo do plano que chega à escola, e sem nada clínico.

| Coluna | Tipo | Nulo | Chave | Descrição |
|---|---|---|---|---|
| `id` | uuid | não | PK | Identificador. |
| `objetivoId` | uuid | não | FK | O objetivo a que o cartão serve. |
| `tituloSimples` | text | não |  | Título em linguagem cotidiana. |
| `oQueFazer` | text[] | não (CHECK) |  | O que fazer, item a item. Ao menos um. |
| `oQueEvitar` | text[] | não (CHECK) |  | O que evitar, item a item. Ao menos um. |
| `sinalAlerta` | text | não |  | O sinal de que a criança precisa de apoio. |
| `atualizadoEm` | timestamptz(3) | não |  | Última atualização. |

**Restrições e índices**

- Chave primária: (id)
- Chave estrangeira: (objetivoId) → objetivo(id); ao apagar: restringe; ao atualizar: cascata
- CHECK: oQueEvitar com ao menos um elemento
- CHECK: oQueFazer com ao menos um elemento
- Índice: (objetivoId)

### 3.22 `registro_auditoria`

*Classe:* RegistroAuditoria · *Área:* Identidade

Trilha de auditoria da regra 6: concessões, revogações, leituras autorizadas, tentativas negadas, criações e alterações. Só cresce: não se altera nem se apaga.

| Coluna | Tipo | Nulo | Chave | Descrição |
|---|---|---|---|---|
| `id` | uuid | não | PK | Identificador. |
| `ocorridoEm` | timestamptz(3) | não |  | Quando aconteceu. |
| `usuarioId` | uuid | sim | FK | Quem agiu. Nulo quando foi o próprio sistema. |
| `usuarioNome` | text | sim |  | Nome de quem agiu, como era no momento (fotografia). |
| `perfil` | perfil | sim |  | Perfil com que agiu, como era no momento (fotografia). |
| `acao` | acao_auditoria | não |  | O que aconteceu. |
| `entidade` | text | não |  | Nome da entidade tocada: Paciente, CartaoEstrategia, Consentimento… |
| `idEntidade` | uuid | sim |  | O registro tocado, quando é um só. Sem chave estrangeira. |
| `pacienteId` | uuid | sim |  | O paciente a que o dado pertence, para filtrar a trilha. Sem chave estrangeira. |
| `origem` | origem_auditoria | não |  | De que área veio a ação. |
| `ipOrigem` | text | sim |  | Endereço de origem da requisição. Só o servidor o conhece. |
| `detalhe` | text | não |  | Descrição legível do que aconteceu. |
| `valorAnterior` | text | sim |  | JSON canônico só dos campos que mudaram, na versão anterior — nunca o registro inteiro, por minimização. Nulo quando não há valor anterior a preservar. |

**Restrições e índices**

- Chave primária: (id)
- Chave estrangeira: (usuarioId) → usuario(id); ao apagar: restringe; ao atualizar: cascata
- Gatilho: registro_auditoria_imutavel — Recusa UPDATE e DELETE: a trilha de auditoria só cresce (regra 6).
- Gatilho: registro_auditoria_sem_truncate — Recusa TRUNCATE na trilha de auditoria.
- Índice: (pacienteId, ocorridoEm)
- Índice: (usuarioId)

## 4. O que o banco não guarda, de propósito

- **A situação do consentimento** (vigente, revogado, expirado, aguardando início): deriva das datas a cada leitura, para não ficar desatualizada (regra 5).
- **O texto do termo de consentimento:** vive versionado em `compartilhado/src/dominio/termo.ts` e se reproduz da versão mais os campos do consentimento; `hashTermo` prova que nada mudou.
- **`SEM_PLANO`:** é o estado da tela para quem ainda não tem plano, e não a situação de um plano que existe.
- **A senha:** só o resumo argon2id, em `usuario.senhaHash`.
- **Dado pessoal real:** todos os registros são fictícios.

## 5. Limites declarados

- O papel dono das tabelas pode desligar um gatilho. Em produção, a aplicação conecta com um papel que não é dono (`docs/07`, Etapa 9, passo 5).
- As chaves compostas só restringem quando há quem aponte: o paciente de um consentimento sem vínculo escolar ainda pode ser trocado no banco. Nenhuma operação do contrato faz isso.
- `objetivoIds` e as colunas de fotografia não têm chave estrangeira por desenho; os objetivos do relatório são conferidos na emissão, por gatilho.
