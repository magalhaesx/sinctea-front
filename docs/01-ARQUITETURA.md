# 01 · Arquitetura

Documento normativo. Se o código divergir daqui, o código está errado.

Revisto em 13/10/2026 para o servidor e em 18/10/2026 para o sistema publicado. **O porquê** de cada decisão está no
`docs/07` (D1 a D9); aqui fica **como o código se organiza**.

---

## 1. Um repositório, três pacotes

| Pacote | Pasta | O que contém |
|---|---|---|
| front (`sinctea-front`) | raiz, `src/` | React, rotas, telas, camada de serviços do lado do navegador |
| `@sinctea/compartilhado` | `compartilhado/` | `tipos.ts`, `contratos.ts` e `dominio/` — o mesmo código nos dois lados |
| `@sinctea/servidor` | `servidor/` | NestJS, Prisma e a API em `/api`; em produção, também entrega o front |

**Direção das dependências, sem exceção:**

```
front ──▶ compartilhado ◀── servidor
```

- `compartilhado/` não importa de `src/` nem de `servidor/`.
- O front não importa de `servidor/` nem de `@prisma/*`.
- O servidor não importa de `src/`. **A semente de teste é portada do mock, não
  importada dele** — o mock sai na Etapa 12 e a semente fica.

O teste de arquitetura (`src/arquitetura.test.ts`) garante essas regras.

**Formato de módulo:** ESM nos três pacotes. Imports relativos dentro de
`compartilhado/` e `servidor/` levam `.js`, como o Node exige. O front, o Vite e o
Vitest leem o fonte TypeScript do compartilhado pela condição `fonte` do
`package.json`; o servidor, em produção, lê `compartilhado/dist`, que o build dele
gera antes.

**O domínio roda nos dois lados**, por isso fica restrito ao que existe nos dois:
nada de `window`, `document`, `Buffer` ou `fs` em `compartilhado/`. O compartilhado
compila sem a biblioteca DOM; o front compila sem os tipos do Node. Um uso
indevido quebra um dos dois builds.

Um único `npm test` na raiz roda os três pacotes.

## 2. Um endereço

Em produção, um único serviço no Render (D3):

- `/api/*` — a API do NestJS;
- todo o resto — o build estático do front, entregue pelo mesmo NestJS.

Mesma origem significa cookie de sessão `httpOnly` e `SameSite=Lax`, sem CORS e
sem token no `localStorage`.

**Mantenha `HashRouter`.** Com ele, o servidor não precisa de regra de *fallback*
para as rotas do front: tudo depois do `#` é do navegador. Os endereços terão `#`
— isso é proposital.

A publicação é do workflow **Publicar** (`.github/workflows/deploy.yml`). Ele:
- roda os testes contra um PostgreSQL 17;
- constrói a imagem Docker e a põe para rodar;
- aplica as migrações no Neon com o papel dono.

Só então o Render publica (*After CI Checks Pass*). O GitHub Pages foi desativado
em 17/10/2026.

## 3. Mapa de rotas

### Front

```
/                        Redireciona para /app/entrar
/sobre                   O projeto, a equipe e o estágio atual

/app/entrar              Login
/app/primeiro-acesso/:token  Definir a própria senha pelo link de uso único
/app/convite/:token      Aceite de convite (professor)
/app                     Redireciona conforme o perfil autenticado

/app/clinica                                       Painel do profissional
/app/clinica/pacientes                             Lista de pacientes
/app/clinica/pacientes/novo                        Cadastro de paciente
/app/clinica/pacientes/:id                         Ficha do paciente
/app/clinica/pacientes/:id/plano                   Plano Terapêutico Individual
/app/clinica/pacientes/:id/sessao                  Registro de sessão
/app/clinica/pacientes/:id/evolucao                Evolução por objetivo
/app/clinica/pacientes/:id/atividades              Prescrever atividade para casa
/app/clinica/pacientes/:id/relatorio               Emitir relatório de evolução
/app/clinica/pacientes/:id/relatorio/:relatorioId  Relatório emitido

/app/coordenacao                  Painel de indicadores da clínica
/app/coordenacao/planos           Validar planos terapêuticos
/app/coordenacao/auditoria        Registro de auditoria

/app/admin/usuarios               Gerenciar usuários e perfis
/app/admin/trilha                 Trilha administrativa (tela 25)

/app/familia                      Painel da família
/app/familia/atividades/:id       Atividade em casa
/app/familia/consentimento        Autorizar e revogar acesso da escola

/app/escola                       Meus alunos (tela 22)
/app/escola/:pacienteId           Cartão de estratégias
/app/escola/:pacienteId/ocorrencia  Registrar ocorrência

/app/conta               Perfil e preferências
/app/ajuda               Central de acessibilidade e ajuda

/dev/estados             Vitrine de estados — só no servidor de desenvolvimento
```

A página institucional em `/` está suspensa (`docs/04`); volta na Etapa 13 se
sobrar tempo. `/dev/estados` não existe na versão publicada.

**Na versão publicada, só existem as rotas cujo serviço já está no servidor**
(`docs/07`, seção 0). As outras — evolução por objetivo (tela 8), atividades, relatório, indicadores e
auditoria — somem da navegação e das rotas até o serviço chegar. Nunca aparecem
com dado simulado.

**Toda tela do app tem um caminho de volta visível** (por exemplo, Pacientes ›
nome do paciente › Plano), e o Voltar do navegador funciona.

### API

Tudo sob `/api`: autenticação, usuários, pacientes, planos, sessões, família,
escolas, consentimentos, convites, área da escola, ocorrências e `GET /api/saude`.
Os serviços que faltam entram depois de 19/10. A documentação OpenAPI (`docs/07`,
seção 3A) ainda não existe; quando existir, também fica sob `/api`.

## 4. Estrutura de pastas

```
/                              Pacote do front
├── src/
│   ├── main.tsx
│   ├── App.tsx                Rotas
│   ├── index.css              Tokens e base
│   ├── app/                   Sistema: clinica/, coordenacao/, admin/,
│   │                          familia/, escola/, Entrar, Convite, Conta, Ajuda
│   ├── componentes/           Peças compostas usadas por mais de uma tela
│   ├── contexto/              Preferencias, Sessao, ExigePerfil
│   ├── graficos/              Visualizações
│   ├── paginas/               Sobre e a vitrine de estados
│   ├── ui/                    Componentes base do design system
│   └── servicos/              Ver seção 5
│       ├── index.ts           Ponto único de acesso a dados
│       ├── api/               Cliente HTTP da API
│       └── mock/              Implementação simulada — sai na Etapa 12
│
├── compartilhado/
│   └── src/
│       ├── index.ts
│       ├── tipos.ts           Entrada e saída de toda chamada
│       ├── contratos.ts       Os 16 serviços
│       └── dominio/           regras, datas, csv, hash, auditoria, termo
│
├── servidor/
│   ├── prisma/
│   │   ├── schema.prisma      Fonte única do DER e do dicionário de dados
│   │   ├── migracoes/         Uma pasta por migração; nunca editar a já aplicada
│   │   └── semente.ts         Dados fictícios de teste e desenvolvimento
│   ├── src/
│   │   ├── main.ts            Abre a porta
│   │   ├── aplicacao.ts       Monta o Nest; main.ts e os testes usam a mesma
│   │   ├── modulo-aplicacao.ts
│   │   ├── gerado/            Cliente do Prisma — gerado, fora do git
│   │   └── <modulo>/          Um por área: saude/, pacientes/, consentimentos/…
│   └── test/
│
└── docs/
```

## 5. A camada de dados

Esta é a decisão de arquitetura mais importante do projeto, e a que mais
economiza retrabalho.

### O princípio

Os componentes **nunca** importam dados diretamente. Eles chamam serviços que
retornam `Promise`. Até a Etapa 12, a implementação pode ser a simulada ou a
real; depois, só a real. Nenhum componente muda.

### O contrato

`compartilhado/src/contratos.ts` declara as interfaces. Exemplo:

```ts
export interface ServicoPaciente {
  listar(filtro?: FiltroPaciente): Promise<Pagina<PacienteResumo>>
  obter(id: string): Promise<Paciente>
  criar(dados: NovoPaciente): Promise<Paciente>
}
```

**No servidor, o contrato é a referência de cada rota:** mesma entrada, mesma
saída, mesmos erros (`CodigoErro` e `MotivoNegativa`). A suíte que hoje prova as
regras contra o mock é portada para provar as mesmas regras contra a API (D8).

### As implementações no front

```
servicos/mock/   → dados fictícios em memória, com latência e falha simuladas
servicos/api/    → fetch contra /api
servicos/index.ts → escolhe uma das duas por VITE_API_URL
```

Na Etapa 12, `servicos/mock/` e a escolha somem: `servicos/index.ts` passa a
exportar só a API.

### Regras que não podem ser quebradas

No front:

1. **Nenhum componente conhece `servicos/mock` nem `servicos/api`.** Importa
   sempre de `servicos`.
2. **Toda listagem é paginada**, mesmo com cinco registros. `Pagina<T>` com
   `itens`, `total`, `pagina`, `porPagina`. Séries de gráfico agregadas não são
   listagens e não são paginadas — a exceção fica declarada no contrato.
3. **Toda tela trata carregamento e erro.** Enquanto o mock existir, ele simula
   latência de 200 a 600 ms e falha acionável por `VITE_MOCK_FALHA` (`0.1` falha
   10% das vezes), para que esses estados sejam exercitados. Com a API, a rede
   faz esse papel.

No servidor:

4. **O Prisma só existe dentro de `servidor/`.**
5. **Nenhuma resposta devolve um modelo do Prisma.** A saída é sempre um tipo de
   `compartilhado/`, montado por um mapeador. É o que mantém `senhaHash` fora de
   toda resposta, por construção.
6. **O controlador não decide acesso.** Quem decide são os *guards* e os
   serviços, portados dos auxiliares do mock (D7). O controlador recebe,
   delega e devolve.
7. **Quem audita é o interceptador** (regra 6, Etapa 10), não cada função
   lembrando de auditar.

### Regras de negócio ficam em `compartilhado/src/dominio/`

Funções puras: sem React, sem rede, sem banco. Por exemplo:

```ts
export function objetivoAtingiuCriterio(sessoes: Sessao[], criterio: CriterioDominio): boolean
export function consentimentoVigente(c: Consentimento, agora: Date): boolean
export function escopoPermiteLeitura(c: Consentimento, escopo: EscopoAcesso): boolean
```

A **mesma** função roda no front, para mostrar, e no servidor, para decidir.
Quando os dois lados discordarem, quem vale é o servidor: no front, o domínio é
apresentação; no servidor, é fronteira de confiança.

## 6. Autenticação

**Real desde 16/10/2026 (D5):**

- e-mail e senha; senha guardada com argon2id, nunca em texto;
- sessão guardada no PostgreSQL, identificada por cookie `httpOnly`,
  `SameSite=Lax`, `Secure` em produção;
- `contexto/Sessao.tsx` pergunta ao servidor quem está autenticado — e o resto do
  front continua igual;
- ninguém conhece a senha de outra pessoa: quem cadastra entrega um link de uso
  único (72 h), e a própria pessoa define a senha;
- limite de tentativas de entrada por e-mail e por IP;
- **uma conta por aba** (item 9, 24/10): até cinco contas no mesmo navegador,
  cada uma no seu cookie `httpOnly`; a aba guarda só o número da vaga e o manda
  no cabeçalho `X-Sinctea-Aba`. O token nunca vai para o `sessionStorage` nem
  para o `localStorage` (`docs/07`, D5);
- a aba duplicada leva a mesma conta: se uma das duas sair ou trocar de perfil,
  a outra avisa em vez de falhar em silêncio.

`<ExigePerfil>` continua nas rotas, mas **é navegação, não segurança**. Deixe
isso escrito em comentário no código: a verificação que vale é o *guard* do
servidor.

O acesso sem senha (`entrarDemonstracao`) não existe na versão publicada (D6).
O primeiro administrador nasce de um comando rodado uma vez, fora do site
(`npm run criar-administrador`); todo o resto nasce pelas telas.

## 7. Banco de dados

PostgreSQL 17 em todo lugar: Neon em produção, serviço do GitHub Actions no CI e
um PostgreSQL embutido (pacote `embedded-postgres`) na máquina de
desenvolvimento, sem instalação nem Docker.

`servidor/prisma/schema.prisma` é a **fonte única** do modelo físico. O DER e o
dicionário de dados são gerados dele, e não desenhados à parte. Toda mudança é
uma migração nova; **migração já aplicada não se edita**.

### Do diagrama de classes para as tabelas

| No diagrama | No banco |
|---|---|
| Classe com identidade (`id : UUID`) | Tabela, nome em `snake_case` (`@@map`); colunas com os nomes de `tipos.ts` |
| `Usuario` e as três subclasses | Tabela por subclasse: `usuario`, e `profissional`, `responsavel` e `professor_aee` com chave primária `usuarioId`, que é também chave estrangeira para `usuario` |
| `CriterioDominio` (objeto de valor, sem identidade) | Colunas de `objetivo` |
| Atributo `[1..*]` (`perfis`, `escopos`, `passos`, `oQueFazer`, `oQueEvitar`) | Array do PostgreSQL, com `CHECK` de pelo menos um elemento |
| `DateTime` | `timestamptz(3)` — nunca `timestamp` sem fuso |
| `Date` | `date`. Trafega como `"AAAA-MM-DD"` (`DataCivil`), nunca como instante, e não passa por `new Date()` para ser exibida. `validadeAte` vale **até o fim daquele dia** no fuso da instância, America/Manaus |
| Composição (`PlanoTerapeutico ◆ Objetivo`, `Sessao ◆ RegistroAtividade`) | Chave estrangeira obrigatória, `ON DELETE RESTRICT`. Prontuário não se apaga — nem em cascata |
| O mesmo paciente alcançável por dois caminhos | **Os caminhos concordam por construção:** chave estrangeira composta quando o caminho repetido tem um passo; *trigger* quando tem mais de um. A coluna que define o dono (`plano_terapeutico.pacienteId`, `objetivo.planoId`, `sessao.pacienteId`) não muda depois de criada |
| Enumeração | `enum` do PostgreSQL |
| Faixa fechada (`NivelSuporte` 1–3, intensidade 1–5, percentuais 0–100) | `CHECK` na migração |
| Fotografia (`RegistroAuditoria.usuarioNome`, `RelatorioEvolucao.autorNome`) | Coluna própria, **sem** chave estrangeira — a fotografia sobrevive à mudança do original |
| `RelatorioEvolucao.conteudoEmitido` | `text` com o JSON canônico exato que foi resumido no hash. **Nunca `jsonb`**: o `jsonb` reescreve o texto, e o documento emitido precisa sair igual |

### Tabelas que só crescem

`registro_auditoria` e `relatorio_evolucao` têm *trigger* que recusa `UPDATE`,
`DELETE` e `TRUNCATE`. Um teste de integração tenta cada um e espera a recusa.

Limite declarado: o dono da tabela pode desligar o *trigger*. Em produção, a
aplicação conecta com um papel que não é dono das tabelas; as migrações rodam
com o dono (Etapa 9, passo 5).

## 8. Dados

**Em produção, o sistema nasce vazio** (`docs/07`, seção 0). Nada é
pré-carregado; tudo é cadastrado pelas telas.

**Nos testes e no desenvolvimento**, os dados são fictícios e próprios:
- `src/servicos/mock/dados.ts`, enquanto o mock existir;
- `servidor/prisma/semente.ts`, que nunca roda em produção.

São muitos, e não um: uma lista com um item não exercita paginação, busca,
filtro, ordenação nem estado vazio. Os e-mails ficam no domínio reservado
`.example`.

**Nenhum dado de paciente real, em nenhuma hipótese.** A tela de entrada e o
rodapé dizem: *"Ambiente acadêmico do TCC SINCTEA. Não cadastre dados de
pacientes reais."*
