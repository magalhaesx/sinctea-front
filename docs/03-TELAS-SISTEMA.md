# 03 · Telas do sistema

Revisão de 25/10/2026, atualizada em 26/10. A especificação de setembro dizia o
que construir; esta diz o que existe, conferido no código até o item 13. Os
textos entre aspas são os que a pessoa lê na tela.

**Situação de cada tela:**

- **no ar**: está na versão publicada, sinctea.onrender.com.
- **só no desenvolvimento**: fica fora do caminho principal (`docs/07`, seção
  0). A rota nem existe na versão publicada, até o serviço dela chegar ao
  servidor. Nunca aparece com dado simulado (`src/app/caminhoPrincipal.ts`).

A numeração de setembro continua. Três telas nasceram depois:

- a 23, para definir a senha;
- a 24, para cadastrar o paciente;
- a 25, a trilha administrativa.

---

## Perfis e o que cada um alcança

O código diz `TERAPEUTA`; a tela diz **"Profissional da clínica"** (item 7).
Nenhuma tela diz "terapeuta". Quem atende aparece pela especialidade:
"Ana Souza · Psicologia".

| Perfil, como aparece | No ar | Só no desenvolvimento |
|---|---|---|
| Profissional da clínica | 3, 4, 24, 5, 6, 7 | 8, 9, 10 |
| Coordenador clínico | as da clínica, e 12 | 11, 13 |
| Administrador | 14, 25 | — |
| Responsável | 15, 17 | 16 |
| Professor / AEE | 22, 18, 19 | — |
| Todos | 20, 21 | — |
| Sem conta | 1, 2, 23 | — |

- Uma conta pode ter mais de um perfil. A troca é na tela 21.
- **Cada aba do navegador tem a sua conta** (item 9; `docs/07`, D5). Uma aba
  de administrador, uma de profissional e uma de responsável funcionam ao mesmo
  tempo, até cinco contas por navegador.

---

# Moldura

Vale para todas as telas de `/app`.

**Topo** (item 12):

- à esquerda, o botão ☰ e "SINCTEA · Continuidade terapêutica no TEA"; abaixo
  de 640px, só "SINCTEA";
- a partir de 1024px, à direita, o nome de quem está na sessão, com o papel
  embaixo, e o botão "Sair". Abaixo disso, os dois ficam dentro do menu.

O papel é a especialidade, para o profissional da clínica que a cadastrou. Para
os demais, é o nome do perfil.

**Menu.** Fica atrás do botão ☰, em qualquer largura (item 12). Mostra só as
telas do perfil **ativo**. Esconder item de menu não é segurança: quem autoriza
é o servidor.

- o ☰ tem 44px e diz "Abrir o menu" ou "Fechar o menu", conforme o estado;
- abre como uma gaveta pela esquerda, por cima do conteúdo, com o fundo
  escurecido;
- dentro dela, os grupos do perfil ativo, com a tela atual marcada, e
  "Preferências": Texto maior, Alto contraste, Reduzir animação. Abaixo de
  1024px, também o nome, o papel e o "Sair". Os códigos UC só aparecem a partir
  de 1024px;
- é um diálogo modal: o foco vai para o primeiro item e fica preso na gaveta;
  Esc, o ✕ e o toque no fundo fecham, e o foco volta ao ☰; escolher uma tela
  fecha; o conteúdo atrás fica inerte; com "Reduzir animação", abre sem
  deslizar;
- o "Pular para o conteúdo" continua o primeiro item do teclado. Entrar,
  aceitar convite e definir senha não têm menu.

| Perfil ativo | Itens |
|---|---|
| Profissional da clínica | Painel do profissional · Pacientes |
| Coordenador clínico | Painel do profissional · Pacientes · Validar planos |
| Administrador | Usuários e perfis · Trilha administrativa |
| Responsável | Painel da família · Autorizar a escola |
| Professor / AEE | Meus alunos |
| Todos | Perfil e preferências · Acessibilidade e ajuda |

**Trilha.** Toda tela do app tem um caminho de volta visível:

- formato: "Você está em: Área clínica › Pacientes › Ana › Plano Terapêutico
  Individual";
- os itens com destino são links;
- o último item é a própria tela, em negrito, com `aria-current="page"`;
- enquanto o nome do paciente carrega, a trilha diz "Paciente".

**Rodapé:** *"Ambiente acadêmico do TCC SINCTEA. Não cadastre dados de
pacientes reais."* Tirar o aviso é decisão do Lucas com a orientadora
(`docs/01`, seção 8).

**Aviso de senha redefinida** (item 8). Aparece acima de qualquer tela depois
que a pessoa usa um link de nova senha:

- texto: *"Sua senha foi redefinida pela clínica em {data} às {hora}, a pedido
  de {nome}. Se não foi você quem pediu, procure a clínica."*;
- a hora é a de Manaus;
- o aviso volta, em qualquer aba e em qualquer acesso, até a pessoa clicar em
  "Entendi". A ciência fica no servidor (`acesso_inicial.avisadoEm`).

**Aviso de janela** (item 7). Com uma conta por aba, só sobra um caso: a aba
duplicada, que leva a mesma conta. Se uma das duas sair ou trocar de perfil, a
outra mostra uma faixa no alto, que recebe o foco:

- *"Esta janela agora está com o perfil {perfil}. Recarregue a página para
  continuar."*;
- *"A conta desta janela saiu em outra janela. Recarregue a página para entrar
  de novo."*

---

# Acesso

## 1 · Entrar · no ar
`/app/entrar` · sem conta · transversal ("Autenticar-se", `Usuario.autenticar()`)

**Conteúdo, nesta ordem:**

1. "Entrar no SINCTEA", com o subtítulo "A informação acompanha a pessoa, não
   a instituição".
2. O aviso do ambiente, em destaque. Por isso esta tela não tem rodapé.
3. **"Contas abertas neste navegador"** (item 9). Só aparece se houver alguma.
   - Cada linha: nome, perfil ativo e o botão "Continuar como {nome}".
   - Embaixo: "Ou entre com outra conta abaixo. Cada aba fica com a sua."
4. E-mail, senha e o botão "Entrar".
5. **"Esqueci minha senha"**. Não leva a outra tela: abre um texto que diz a
   quem pedir.
   - Equipe da clínica: à administração, que gera um link para nova senha
     (tela 14).
   - Responsável: à coordenação, que gera um link para nova senha (tela 5).
   - Escola: *"Se você é da escola, peça à clínica: a administração gera um
     link para você escolher uma nova senha."* (tela 14).
   - Não há envio de e-mail.
6. "Conhecer o SINCTEA", que leva a `/sobre`.

O bloco "Entrar para demonstração" só existe no desenvolvimento, com a
implementação simulada. Ele nem entra no pacote publicado (`docs/07`, D6).

**Mensagens.** Ficam numa região `role="alert"`, e o foco volta ao e-mail.

| Situação | Mensagem |
|---|---|
| Credencial errada, ou conta desativada | "E-mail ou senha incorretos." Nunca revela se o e-mail existe. |
| Cinco contas já abertas | "Já há 5 contas abertas neste navegador. Saia de uma delas para entrar com outra." |
| A conta da lista fechou | "A conta de {nome} não está mais aberta. Entre com o e-mail e a senha." |
| Limite de tentativas | A mensagem do servidor. O limite é 5 por e-mail ou 20 por IP em 15 minutos. |

**Regras:**

- sem CAPTCHA (e-MAG 6.8; WCAG 3.3.8);
- a sessão dura 24 horas desde o último uso, e por isso não expira sem aviso
  (WCAG 2.2.1);
- depois de entrar, a pessoa volta à tela que tentou abrir.

**Aceitação:** operável só por teclado · erro anunciado em região dinâmica · a
lista de contas abertas nunca mostra e-mail nem token.

## 2 · Aceitar convite · no ar
`/app/convite/:token` · Professor / AEE, ainda sem conta

O professor chega pelo link que a família entrega (tela 17). É o único caminho
de entrada da escola: **não existe autocadastro de professor.**

**Conteúdo, nesta ordem:**

1. "Aceitar o convite da família", com o subtítulo "{responsável} convidou
   você a acompanhar {aluno} na {escola}". A escola não é perguntada: quem a
   nomeou foi a família.
2. "O que você poderá ver": os escopos, e "O acesso vale até {data} e a
   família pode encerrá-lo quando quiser."
3. **"O que você nunca verá", antes do formulário:**
   - o plano terapêutico e os gráficos de evolução;
   - diagnóstico, laudos e relatórios clínicos;
   - o histórico de sessões da clínica.
4. O formulário.
   - *"Se você já tem conta no SINCTEA, use o mesmo e-mail e senha. O aluno
     novo entra na sua lista."*
   - Campos: nome, e-mail e senha.
   - Também pede turma, turno e "Como você atua com este aluno".
   - Botão "Aceitar o convite". Ao terminar, vai para a tela 22, já com a
     sessão aberta numa vaga da aba.

**Estados, cada um com texto próprio e o link "Ir para a entrada do sistema":**

- já usado: *"Cada convite vale para um único cadastro."*;
- expirado: *"O convite vale por 72 horas. Peça à família que gere outro: a
  autorização dela continua valendo, só o convite venceu."*;
- autorização encerrada antes do aceite: *"Quem decide é a família."*

**Aceitação:** a lista do que ele não verá aparece antes do formulário ·
errar a senha de uma conta que já existe conta no limite de tentativas.

## 23 · Definir minha senha · no ar
`/app/primeiro-acesso/:token` · quem recebeu o link, ainda sem senha

Ninguém conhece a senha de outra pessoa (`docs/07`, seção 0). Quem cadastra
entrega um link de uso único, e a própria pessoa escolhe a senha. O mesmo link
serve à nova senha de quem já tinha senha, sempre com motivo, que vai para a
trilha:

- o do responsável, só a coordenação gera (item 8, tela 5);
- o da equipe e o do professor, só a administração gera (item 13, tela 14).

| | Primeiro acesso | Nova senha |
|---|---|---|
| Título | "Definir minha senha" | "Escolher uma nova senha" |
| Subtítulo | "A conta de {nome} ({e-mail}) está pronta. Falta só a sua senha." | "…Ao salvar, a senha anterior deixa de valer e as sessões abertas se encerram." |
| Botão | "Definir senha e entrar" | "Salvar a nova senha e entrar" |

**Campos:** "Crie uma senha", com ao menos 8 caracteres, e "Repita a senha". Se
as duas não forem iguais: "As duas senhas não conferem."

**Estados:**

- já usado;
- vencido (72 horas): *"Peça um novo a quem cadastrou você: a conta continua
  lá, só o link venceu."*;
- inexistente: *"Se um link mais novo foi enviado, só ele vale."*;
- conta desativada.

**Depois de salvar:**

- o link é gasto;
- as outras sessões da conta se encerram;
- abre-se a sessão nesta aba e a pessoa vai para o seu painel;
- se o link era de nova senha, aparece o aviso da moldura.

**Regras:**

- 72 horas, uso único;
- o banco guarda só o resumo SHA-256 do código;
- um link novo invalida os anteriores ainda não usados da mesma conta.

---

# Área clínica

## 3 · Painel do profissional · no ar
`/app/clinica` · Profissional da clínica, Coordenador clínico · UC10, UC06

**No ar:**

- o título é a data por extenso;
- o subtítulo conta os avisos novos da escola;
- **"Avisos da escola"**: até cinco, dos últimos sete dias.
  - Cada aviso traz paciente, hora, escola e "Relato: {tipo} · intensidade N de
    5. A leitura clínica é sua."
  - Botões: "Registrar a leitura clínica" e "Abrir a ficha de {nome}".
- o botão "Ver meus pacientes".

**Regras:**

- os avisos são só os eventos ainda preliminares: é a fila do que espera a
  leitura clínica;
- registrada a leitura, o aviso sai da lista, e o histórico fica na ficha.

**Só no desenvolvimento:** a agenda do dia, com a situação de cada atendimento,
e a contagem de registros aguardando sincronização.

**Aceitação:** sem aviso, *"Nenhum aviso novo da escola nos últimos sete
dias."*, e não uma lista em branco.

## 4 · Lista de pacientes · no ar
`/app/clinica/pacientes` · Profissional da clínica, Coordenador clínico · UC01

**Conteúdo:**

- busca por nome;
- filtros: profissional responsável ("Nome · Especialidade"), nível de suporte e
  situação do plano, incluindo "Sem plano";
- os filtros ficam no endereço;
- tabela com paciente, idade, nível de suporte por extenso, profissional
  responsável, situação do plano e última sessão;
- 10 por página;
- o botão "Cadastrar paciente".

**Regras:**

- o profissional vê só os pacientes de cuja equipe faz parte, e o coordenador
  vê todos;
- o rótulo acima da tabela mostra essa diferença: "Você acompanha N pacientes"
  ou "N pacientes na clínica".

**Estados vazios:**

- com filtro: *"Nenhum paciente encontrado"*, com "Limpar os filtros";
- sem nenhum paciente: *"Nenhum paciente cadastrado ainda"*, com "Cadastrar
  paciente". É a primeira tela de uma clínica que acabou de nascer.

**Aceitação:** a tabela tem `caption` e `th scope`, e rola em recipiente
próprio, sem empurrar a página.

## 24 · Cadastrar paciente · no ar
`/app/clinica/pacientes/novo` · Profissional da clínica, Coordenador clínico · UC01

**Campos:**

- nome completo;
- data de nascimento;
- nível de suporte, "Conforme o DSM-5-TR, registrado no laudo";
- profissional responsável pelo caso. Se quem cadastra é profissional da
  clínica, o campo já vem com ele, e pode ser trocado.

Os erros vêm do servidor, em cada campo. Depois de salvar, a pessoa vai para a
ficha do novo paciente. A equipe nasce com o responsável pelo caso e com quem
cadastrou. O plano vem depois, na tela 6.

## 5 · Ficha do paciente · no ar
`/app/clinica/pacientes/:id` · Profissional da clínica, Coordenador clínico · UC01

**Blocos, nesta ordem:**

1. **Identificação:**
   - idade e data de nascimento;
   - nível de suporte sempre por extenso, por exemplo "Nível 2 — exige apoio
     substancial". Ninguém precisa decorar o que significa "2";
   - situação do plano.
2. **Rede de apoio**: os responsáveis, com parentesco, telefone e e-mail, e a
   etiqueta "Responsável legal" ou "Não responde legalmente". Detalhes abaixo.
3. **Equipe multiprofissional:** o nome, com a especialidade embaixo, e a
   etiqueta "Responsável pelo caso".
4. **Vínculo escolar:** a escola, com turma, turno e professor. Situação:
   "Acesso vigente", "Acesso encerrado pela família", "Prazo do acesso
   terminado" ou "Acesso ainda não começou".
5. **Eventos comportamentais dos últimos 30 dias, de todas as origens**
   (clínica, casa, escola):
   - cada um com intensidade;
   - "Aguardando leitura clínica", com o botão "Registrar a leitura clínica", ou
     "Leitura clínica em {data}";
   - 5 por página;
   - sem evento, o texto diz que eles entram pelo registro em sessão ou por
     relato da escola.
6. **Histórico resumido:** sessões encerradas e a data da última.
7. **Histórico de sessões:** a evolução de cada sessão encerrada, da mais
   recente para a mais antiga, com quem conduziu ("Nome · Especialidade") e o
   número de registros. 5 por página.
8. **Ações:** "Abrir o plano terapêutico" e "Iniciar sessão". Evolução,
   atividades e relatório só aparecem no desenvolvimento.

**Rede de apoio:**

- **Cadastrar responsável:**
  - campos: nome, e-mail, telefone e parentesco;
  - pergunta: *"É o responsável legal por {nome}?"*. **Nada vem marcado: a
    autoridade legal nunca se presume.**
  - Conta nova: aparece o link de primeiro acesso, para entregar à pessoa.
  - Conta que já existia: *"nenhum link foi gerado"*.
- **Enquanto a pessoa não definiu a senha:**
  - aparece a etiqueta "Ainda não definiu a senha";
  - o botão "Gerar novo link" serve a qualquer pessoa da equipe;
  - o link anterior deixa de valer.
- **Depois que a pessoa definiu a senha:**
  - Coordenação: aparece **"Gerar link para nova senha"**, com motivo
    obrigatório, de até 500 caracteres, que vai para a trilha com o nome de quem
    gerou. É separação de funções: a senha de quem autoriza a escola (regra 1)
    não passa pela mão de quem atende.
  - Quem não é da coordenação vê a etiqueta "✓ Já definiu a senha" e a frase
    *"Se a pessoa esquecer a senha, quem gera o link para nova senha é a
    coordenação."*
- **O link** aparece uma vez, com "Copiar link":
  - vale 72 horas e uma única vez;
  - *"Ele não aparece de novo: se perder, gere outro."*
- **Editar dados:**
  - nome, telefone e parentesco mudam sempre. São da pessoa, e valem em todas
    as fichas;
  - o e-mail só muda enquanto a senha não foi definida. Depois, *"É o login da
    pessoa, que já definiu a senha: a clínica não o troca."*;
  - **ser ou não o responsável legal não se altera depois do cadastro.**

**Sem alcance:** *"Esta ficha não é do seu alcance"*, sem botão de tentar de
novo. A negativa entra na trilha (regra 6).

## 6 · Plano Terapêutico Individual · no ar
`/app/clinica/pacientes/:id/plano` · Profissional da clínica, Coordenador clínico · UC02, UC03

**Sem plano:**

- *"O plano nasce em rascunho; os objetivos entram nele, e depois ele segue
  para a coordenação validar."*;
- campos "Início do plano" e "Revisão prevista", que sugere seis meses depois;
- o botão "Criar plano".

**Com plano, nesta ordem:**

1. **Cabeçalho:** início, próxima revisão, número de objetivos e a situação:
   "Rascunho", "Aguardando validação", "Devolvido pela coordenação" ou
   "Vigente".
   - "Editar as datas".
   - A alternância "Ver redação acessível" / "Ver redação técnica", que vale
     para a tela inteira.
2. **Plano devolvido:** *"A coordenação devolveu este plano"*, com a
   observação, antes dos objetivos.
3. **Objetivos agrupados por domínio:**
   - a situação: Não iniciado, Em aquisição ou Dominado;
   - o texto na redação escolhida;
   - o medidor de percentual;
   - "Critério: X% em N sessões consecutivas";
   - "Editar o objetivo", que muda as duas redações e o critério. O domínio não
     muda.
4. **Cartão de estratégias para a escola**, em cada objetivo:
   - campos: título "em linguagem simples", "O que ajuda" (uma ação por linha),
     "O que evitar" e "Sinal de alerta";
   - um objetivo pode ter vários cartões;
   - nada é preenchido a partir do objetivo;
   - sem cartão: *"Nenhum cartão ainda: a escola não lê nada sobre este
     objetivo."*
5. **"Adicionar objetivo"**, só com o plano em rascunho ou devolvido:
   - campos: domínio, descrição técnica, **descrição acessível** e critério
     (percentual mínimo, 80 por padrão, e sessões consecutivas, 3 por padrão).
6. **"Enviar para validação"**:
   - *"Se devolver, a observação aparece no topo desta tela."*;
   - se der erro, aparece um aviso vermelho, "Não foi possível enviar".

**Regras:**

- **Regra 4, inviolável:** a descrição acessível é obrigatória e escrita pelo
  profissional. **Não existe botão de gerar, copiar ou sugerir a partir da
  técnica.** O erro explica por que o campo existe: *"A descrição acessível é o
  que a família e a escola vão ler. Ela não é gerada a partir da técnica — quem
  escreve é você."*
- **Datas e objetivos, novos ou editados, só com o plano em rascunho ou
  devolvido** (item 10). Vigente ou em validação, o servidor recusa: *"ele fica
  como está"*. Assim, nenhuma redação acessível chega à família sem a
  conferência da tela 12. Cada edição guarda a versão anterior na trilha.
- Os cartões se escrevem e se editam em qualquer situação do plano.
- **O cartão é o único conteúdo do plano que chega à escola**, e sem nada
  clínico (regra 3).

## 7 · Registro de sessão · no ar
`/app/clinica/pacientes/:id/sessao` · Profissional da clínica, Coordenador clínico · UC04, UC05, UC06

**Conteúdo:**

- o número da sessão, a situação e o local;
- **o estado da conexão, sempre visível**: *"Conectado · cada toque é gravado
  no servidor"* ou *"Sem conexão · o toque não é gravado até a conexão
  voltar"*;
- "Iniciar a sessão" ou "Retomar a sessão". A sessão em andamento ou pausada é
  retomada ao abrir a tela;
- **"Objetivo em trabalho"**, que pode ser trocado: *"Trocar de objetivo não
  perde os registros do anterior."*;
- **"Como foi esta tentativa?"**:
  - quatro botões: "Independente", "Com ajuda gestual", "Com ajuda física" e
    "Sem resposta";
  - um toque registra;
  - "Desfazer" desfaz o último registro da sessão;
- **contagem desta sessão**, por objetivo, e o medidor "Independência em
  {domínio} nesta sessão";
- **ocorrência comportamental, registro ABC:** antecedente, comportamento,
  consequência e intensidade de 1 a 5. Entra nos eventos da ficha;
- "Pausar a sessão" e "Encerrar a sessão".

**Encerrar exige a evolução** (Resolução CFP nº 001/2009, registro documental):

- o campo abre vazio, com até 10.000 caracteres. **O sistema nunca a gera nem a
  pré-preenche**, no mesmo espírito da regra 4;
- só a equipe do paciente e a coordenação a leem, no histórico da ficha. A
  família e a escola, nunca;
- erro: *"Escreva a evolução da sessão antes de encerrar."*

**Regras:**

- quem conduz a sessão é quem a iniciou (`Sessao 0..* — 1 Profissional`), e
  aparece no histórico da ficha;
- não há fila sem conexão na versão publicada: sem conexão, o toque não é
  gravado, e a tela diz isso.

**Aceitação:** desfazer devolve o contador ao valor anterior · trocar de
objetivo não perde registros · encerrar sem evolução não é possível.

## 8 · Evolução por objetivo · só no desenvolvimento
`/app/clinica/pacientes/:id/evolucao` · UC08

**Conteúdo:**

- seletor de objetivo;
- gráfico de linha por sessão, com a referência do critério, e a alternativa
  em tabela;
- situação da promoção a dominado;
- **comparação entre os três contextos** (clínica, casa, escola).

**As três medidas têm naturezas diferentes:** percentual de tentativas na
clínica, escolha em três opções em casa e intensidade de 1 a 5 na escola.

- Nunca vão para a mesma escala, e não se calcula média entre elas.
- Aparecem como três faixas paralelas de tendência, cada uma com a sua escala
  rotulada, na mesma linha do tempo.
- A comparação só aparece com ao menos cinco registros e três semanas em cada
  contexto. Abaixo disso: "dados insuficientes para comparar", e o que falta.

## 9 · Prescrever atividade para casa · só no desenvolvimento
`/app/clinica/pacientes/:id/atividades` · UC07

**Conteúdo:**

- atividades ativas, com frequência e adesão;
- formulário com título, descrição, passos, frequência, vídeo e objetivo
  vinculado;
- histórico das execuções registradas pela família.

**Regras:** a escrita é em linguagem cotidiana. Toda atividade se vincula a um
objetivo do plano.

## 10 · Emitir relatório de evolução · só no desenvolvimento
`/app/clinica/pacientes/:id/relatorio` · UC09

**Conteúdo:**

- período e objetivos;
- destinatário: a equipe ou a família;
- as considerações do profissional, obrigatórias e nunca geradas;
- pré-visualização e histórico.

**Regras:**

- é documento clínico;
- sem o registro no conselho, o relatório não é emitido;
- o emitido não muda (`relatorio_evolucao` só cresce);
- a escola nunca acessa.

---

# Coordenação

## 11 · Indicadores da clínica · só no desenvolvimento
`/app/coordenacao` · UC18

**Conteúdo, nesta ordem:**

1. Quatro números, sempre com o período:
   - pacientes;
   - sessões em 7 dias;
   - objetivos dominados em 30 dias;
   - revisões nos próximos 30 dias.
2. **O que precisa de atenção**, com cada item levando ao registro:
   - planos sem revisão há mais de 90 dias;
   - pacientes sem sessão há mais de 15 dias;
   - consentimentos vencendo em 30 dias;
   - objetivos parados há 8 sessões.
3. Sessões por profissional.
4. A ponte clínica–escola, com a mediana até a leitura clínica.

**Regras:**

- a janela é móvel, e não mês civil;
- usa mediana, e não média;
- conta e aponta, sem descrever conteúdo clínico.

Na versão publicada, a coordenação entra pela tela 12.

## 12 · Validar planos terapêuticos · no ar
`/app/coordenacao/planos` · Coordenador clínico · UC17

É a tela de entrada da coordenação na versão publicada.

**Conteúdo:**

- **fila "Aguardando validação"**:
  - cada item: paciente, autor ("Nome · Especialidade"), data de envio e número
    de objetivos;
  - 10 por página;
- **o plano aberto:**
  - autor, datas e, para cada objetivo, as duas redações **lado a lado**;
  - o critério;
  - a coordenação confere *"inclusive se a redação acessível é mesmo
    acessível"*;
- **decisão:**
  - "Aprovar plano": passa a vigente;
  - "Devolver para ajuste": exige o campo "O que precisa mudar".

**Regras:**

- devolver exige observação. Sem ela: *"Escreva o que precisa mudar. Devolução
  sem justificativa não ensina nada a quem recebeu."*;
- **quem escreveu o plano não o valida**: *"A validação precisa de outra pessoa
  da coordenação"*, e os botões de decisão somem;
- a decisão entra na trilha, com quem decidiu e quando.

**Fila vazia:** *"Nenhum plano aguardando validação"*, com o link para a lista
de pacientes. O histórico das decisões fica na trilha (tela 13, só no
desenvolvimento).

## 13 · Registro de auditoria · só no desenvolvimento
`/app/coordenacao/auditoria` · UC19

Esta tela é a resposta da LGPD, art. 37.

**Conteúdo:**

- filtros por período, usuário, ação e paciente;
- tabela com data e hora, usuário, perfil, ação, entidade e origem;
- exportação.

**Regras:**

- a trilha registra:
  - toda leitura e escrita de dado do paciente;
  - concessão e revogação;
  - **tentativa negada** (regra 6);
- nenhuma tela edita ou exclui um registro. O banco recusa por gatilho
  (`docs/09`).

A trilha já é gravada no ar. O que falta é a tela que a mostra.

---

# Administração

## 14 · Usuários e perfis · no ar
`/app/admin/usuarios` · Administrador · UC20

**Criar conta para a equipe:**

- campos: nome, e-mail e perfis;
- só perfis de equipe: Profissional da clínica, Coordenador clínico e
  Administrador;
- a especialidade é obrigatória para o profissional da clínica;
- o registro no conselho é opcional aqui. Quem o completa é o próprio dono, na
  tela 21;
- *"Esta tela cadastra apenas a equipe da clínica. O responsável nasce do
  vínculo com o paciente, e o professor, do convite da família."*;
- a conta nasce sem senha conhecida. O administrador recebe o link de primeiro
  acesso para entregar (tela 23).

**Lista:**

- busca por nome ou e-mail, e filtros por perfil e situação;
- colunas: nome, e-mail, perfis, situação e último acesso, ou "Aguardando
  primeiro acesso";
- 10 por página.

**Gerenciar uma conta:**

- **Equipe:**
  - editar perfis;
  - enquanto a pessoa não definiu a senha: "Gerar novo link de acesso", sem
    motivo. O anterior deixa de valer;
  - depois que ela definiu a senha: **"Gerar link para nova senha"**, com motivo
    obrigatório, de até 500 caracteres, que vai para a trilha com o nome de
    quem gerou (item 13). O servidor recusa o link sem motivo para quem já tem
    senha.
- **Professor:** o perfil é só leitura, e há "Gerar link para nova senha", com
  motivo, como na equipe. Era a lacuna da escola: antes do item 13, o professor
  não tinha como recuperar a senha.
- **Responsável:** o perfil é só leitura, com a nota de que o link dele é da
  coordenação (tela 5). O servidor recusa o administrador, e a recusa fica na
  trilha.
- **Desativar, em duas etapas, e reativar.**

O link de nova senha funciona como o do item 8: ao ser usado, a senha anterior
deixa de valer e as sessões se encerram. No acesso seguinte, a pessoa vê o
aviso da moldura com o nome de quem gerou. O formulário do motivo recebe o foco
ao abrir e no erro, e o devolve ao botão ao cancelar.

**Regras:**

- desativar, nunca excluir: o histórico clínico precisa manter a autoria;
- o administrador não desativa a si mesmo;
- o administrador não alcança dado clínico (regra 3).

**Para testar a tela 5 com a coordenação:** cadastre aqui uma conta com o perfil
Coordenador clínico, ou marque esse perfil numa conta da equipe.

## 25 · Trilha administrativa · no ar
`/app/admin/trilha` · Administrador · UC19 (o administrador como segundo ator,
só com o recorte administrativo)

O administrador também é auditado (LGPD, art. 37), mas a trilha que ele lê não
tem dado clínico (regra 3). A coordenação lê a trilha clínica na tela 13, que
ainda está só no desenvolvimento.

**O que aparece:** só registros que, ao mesmo tempo, **não têm paciente** e são
de uma entidade da lista: `Usuario`, `Profissional`, `Escola` e
`RegistroAuditoria`. As duas condições são necessárias:

- há registro clínico sem paciente, como a leitura da lista de pacientes, que a
  lista de entidades barra;
- há registro de conta com paciente, como o link do responsável, que a falta de
  paciente barra.

**Colunas:**

- data e hora, no fuso de Manaus;
- quem agiu, com o nome e o perfil como eram;
- a ação;
- a entidade e o detalhe;
- o que mudou (o valor anterior). Na conta, ele aparece para os perfis e a
  situação; no profissional, para a especialidade e o registro no conselho.

O IP não aparece na tela.

**Filtros:** período, pessoa e ação. São 20 por página, do mais recente para o
mais antigo.

**Regras:**

- não se edita, não se apaga e não se exporta;
- ler a trilha também entra na trilha;
- senha e tokens nunca aparecem: nem resumo, nem valor anterior;
- salvar sem mudar nada não gera registro;
- o detalhe usa os nomes de tela dos perfis ("Profissional da clínica"). Os
  registros gravados antes de 26/10 podem trazer o nome interno, como
  "TERAPEUTA": a trilha é imutável, e eles ficam como foram gravados;
- **a escola cadastrada por uma família aparece sem o nome de quem
  cadastrou**: "Um responsável". O administrador precisa da escola para cuidar
  do cadastro, e não de saber qual família está ligada a ela. O nome continua
  guardado no banco, e o filtro por pessoa não traz esses registros.

---

# Área da família

## 15 · Painel da família · no ar
`/app/familia` · Responsável · UC13

**Conteúdo:**

- "Como {nome} está indo";
- seletor "Ver o painel de", quando há mais de um filho;
- **"Como está indo"**:
  - cada objetivo só na redação acessível;
  - um medidor de frequência em palavras;
  - "Já consegue sozinho" quando o objetivo foi dominado;
- **"Acesso da escola"**: uma linha por autorização, com a situação em palavras
  e quem acessa.

**Regras:**

- **nenhum termo clínico nesta área**;
- sem percentual cru: "6 ou 7 de cada 10 vezes" comunica, e "65%" não;
- a família lê só os objetivos do plano **vigente**, já conferido pela
  coordenação;
- no cabeçalho, o papel é o parentesco com o filho escolhido;
- "Atividades desta semana" só aparece no desenvolvimento.

**Vazios:**

- sem criança vinculada: *"Fale com a clínica para que o vínculo seja
  registrado."*;
- sem objetivos: *"A equipe ainda não registrou objetivos para {nome}."*;
- sem acesso de escola, quem não é responsável legal lê *"Somente o
  responsável legal pode autorizar."*

## 16 · Atividade em casa · só no desenvolvimento
`/app/familia/atividades/:id` · UC14

**Conteúdo:**

- a atividade;
- "Como foi hoje?": "Fez sozinho", "Fez com a minha ajuda" ou "Não quis fazer
  hoje";
- observação opcional;
- o histórico do que a família registrou.

## 17 · Autorizar o acesso da escola · no ar
`/app/familia/consentimento` · Responsável · UC11, UC12, UC21

**Regra 1:** só o **responsável legal** concede. **Qualquer responsável
vinculado** encerra. Quem não é responsável legal lê: *"Somente o responsável
legal pode autorizar uma escola. Você pode encerrar um acesso já autorizado."*

**Conceder, em duas etapas:**

1. **"Autorizar uma escola":**
   - **Escola:** escolhida da lista, ou cadastrada pela família.
     - Ao cadastrar (nome, rede de ensino, município), o sistema procura nomes
       parecidos no mesmo município: *"É uma destas?"*.
     - Escolher uma das parecidas mantém as autorizações todas na mesma escola.
     - *"O acesso vale para esta escola. Outra escola precisa de uma
       autorização própria."*
   - **"O que a escola poderá acessar":** "Cartão de estratégias" e "Registrar o
     que acontece na escola", os dois marcados.
   - **"O que a escola nunca verá":** a mesma lista da tela 2, junto da
     autorização.
   - **"Autorizar até":** *"Depois dessa data o acesso se encerra sozinho, sem
     você precisar fazer nada."*
2. **"Leia antes de autorizar":**
   - o termo inteiro, com os dados preenchidos;
   - os botões "Autorizar" e "Voltar e corrigir".

**Depois de conceder:**

- aparece o convite, para entregar ao professor: *"vale para um único cadastro e
  expira em {data}, às {hora}"* (72 horas);
- **o link aparece uma vez**;
- "Gerar novo convite" fica com o responsável legal, enquanto o acesso está
  vigente e o professor não entrou. O anterior deixa de valer.

**Autorizações deste filho:**

- cada uma mostra escola, professor ("Ainda sem professor cadastrado"), turma,
  data da autorização, validade e escopos;
- a etiqueta é "Acesso ativo", "Acesso encerrado", "Prazo terminado" ou "Acesso
  ainda não começou";
- **"Encerrar este acesso"**, em duas etapas: *"A partir de agora a escola
  deixa de ver o cartão de estratégias e não consegue mais registrar
  ocorrências."* **Vale na hora** (regra 5);
- **"Ver o termo que aceitei"** reconstrói o texto e confere com o resumo
  guardado:
  - *"Conferido: nada mudou nesta autorização desde {data}."*;
  - ou *"O texto não confere com o resumo registrado. Avise a clínica."*

**Regras:**

- a situação (vigente, encerrado, vencido, aguardando início) deriva das datas
  a cada leitura (regra 5);
- o termo não é guardado: guarda-se a versão e o resumo (`hashTermo`).

---

# Área da escola

## 22 · Meus alunos · no ar
`/app/escola` · Professor / AEE · UC15, UC21

É a entrada do professor.

**Linhas:**

- **acesso vigente:** o nome leva ao cartão, com turma, turno, escopos e "Acesso
  autorizado até {data}";
- **acesso encerrado ou vencido:** a linha fica, sem link, com "Acesso
  encerrado pela família" e o que fazer: *"peça a ela um novo convite"*;
- **aluno cuja família nunca autorizou não aparece, em hipótese alguma.**

Manter a linha encerrada não vaza informação: o professor já sabia que aquele
aluno está na sua turma. Sumir sem explicação o faria supor defeito, e o passo
27 do diagrama de sequência manda informá-lo do encerramento.

**Vazio:** *"Nenhum aluno autorizado neste momento"*, com a explicação de que
quem autoriza é a família.

## 18 · Cartão de estratégias · no ar
`/app/escola/:pacienteId` · Professor / AEE · UC15, UC21

**Conteúdo:**

- "{aluno} · {turma}", com *"Orientações práticas para o dia a dia em sala. Não
  é diagnóstico nem laudo."*;
- cada estratégia: título, "O que fazer", "O que evitar" e "Sinal de alerta";
- no rodapé: *"Autorizado pela família até {data}. Sua consulta fica
  registrada."*;
- "Registrar uma ocorrência", só quando a família autorizou o registro. A
  resposta do cartão traz os escopos (item 10).

**Regras:**

- **o consentimento é conferido antes de qualquer leitura** (regra 2), com o
  escopo;
- encerrado ou vencido, a tela diz isso, sem tela vazia:
  - *"A família encerrou este acesso."*;
  - ou *"A autorização venceu."*;
- só aparecem os cartões dos objetivos do plano vigente;
- a consulta entra na trilha.

**Sem cartão:** *"Ainda não há estratégias para este aluno"*, e *"O profissional
da clínica escreve o cartão a partir dos objetivos do plano."*

## 19 · Registrar ocorrência · no ar
`/app/escola/:pacienteId/ocorrencia` · Professor / AEE · UC16

**Conteúdo:**

- "O que você observou?";
- *"Descreva o que aconteceu, não o que significa. A leitura clínica é do
  profissional habilitado."*;
- **só opções fechadas, sem texto livre:**
  - "O que aconteceu": saiu da sala, tapou os ouvidos, recusou a tarefa, chorou,
    agrediu-se, outro;
  - "Intensidade": de 1 a 5, com *"1 = quase não atrapalhou · 5 = precisou
    interromper a aula"*;
  - "Em que momento": entrada, atividade em grupo, recreio, troca de atividade,
    saída;
- *"Leva cerca de 20 segundos: três toques e enviar."*

**Validação:** diz o que falta: *"Falta escolher {…}. Toque em uma opção de cada
bloco acima."*

**Depois de registrar:**

- *"O registro foi guardado para a leitura da equipe terapêutica. Você não
  precisa fazer mais nada."*;
- **a correção vale por 30 minutos**: *"Você pode corrigir este registro até às
  {HH:MM}"*;
- a versão anterior fica na trilha. Depois de uma correção, a tela diz: *"A
  versão anterior continua no registro de acessos."*;
- passado o prazo: *"Fale com a equipe terapêutica se precisar de ajuste."*

**Regras:**

- a ocorrência entra na clínica como evento comportamental **preliminar** até a
  leitura clínica (telas 3 e 5);
- o servidor confere o consentimento e o escopo de registro.

---

# Apoio

## 20 · Acessibilidade e ajuda · no ar
`/app/ajuda` · todos

**Conteúdo:**

- os ajustes da interface;
- a navegação por teclado;
- os princípios da WCAG 2.2;
- as heurísticas aplicadas;
- a conformidade declarada.

As perguntas frequentes por perfil ainda não existem.

## 21 · Perfil e preferências · no ar
`/app/conta` · todos

**Cartões:**

1. **Dados da conta:** nome, e-mail e perfis, só para leitura.
2. **Dados profissionais**, para a equipe: especialidade e registro no
   conselho. Quem preenche é o próprio dono, nunca a administração. Sem o
   registro, o relatório não é emitido.
3. **Perfil ativo:** com mais de um perfil, a troca. Ela vale só para a aba,
   que é a vaga dessa conta.
4. **Preferências de leitura:** texto maior, alto contraste e reduzir animação.
   Ficam neste aparelho e valem inclusive na entrada.
5. **"Sair da conta":** encerra a sessão desta aba. As outras abas continuam
   com as suas contas.

---

## Lacunas conhecidas

As seis divergências achadas na revisão de 25/10 foram corrigidas no item 10
(`150b9b5`). Ficam para depois:

- envio de e-mail;
- as telas só no desenvolvimento, cada uma quando o seu serviço chegar ao
  servidor (`docs/07`, seção 0);
- revisar um plano vigente. A família e a escola leem só o plano vigente,
  então devolver o vigente a rascunho as deixaria sem nada durante a revisão.
  O caminho certo é uma versão nova em rascunho, enquanto a vigente continua
  valendo até a coordenação aprovar a nova;
- a conferência da situação do plano e a gravação do objetivo novo não estão
  na mesma trava. Se a coordenação aprovar no mesmo instante em que o objetivo
  é gravado, ele entra (`docs/06`).
