# 01 · Arquitetura

Documento normativo. Se o código divergir daqui, o código está errado.

---

## 1. Uma aplicação, dois públicos

O repositório abriga duas coisas que compartilham o mesmo design system e o mesmo
deploy, mas têm públicos opostos:

| | Site comercial | Sistema |
|---|---|---|
| Rota | `/` | `/app` |
| Público | Clínica que pode comprar | Quem usa no dia a dia |
| Objetivo | Convencer e captar contato | Registrar e consultar |
| Tom | Persuasivo, com dados | Operacional, sem adjetivo |

A separação é de rota, não de projeto. Um repositório, um `npm run build`, um
endereço para mostrar.

**Não duplique tokens de cor nem componentes entre os dois.** Se um botão do site
precisa ser diferente do botão do sistema, ele é uma variante do mesmo componente,
não um componente novo.

## 2. Mapa de rotas

```
/                        Início — o problema e a proposta
/solucao                 Como funciona nos três contextos
/acessibilidade          Compromisso público de acessibilidade
/projeto                 O TCC, a equipe e o estágio atual
/contato                 Lista de espera

/app/entrar              Login
/app/convite/:token      Aceite de convite (professor)
/app                     Redireciona conforme o perfil autenticado

/app/clinica             Painel do terapeuta
/app/clinica/pacientes   Lista de pacientes
/app/clinica/pacientes/:id             Ficha do paciente
/app/clinica/pacientes/:id/plano       Plano Terapêutico Individual
/app/clinica/pacientes/:id/sessao      Registro de sessão
/app/clinica/pacientes/:id/evolucao    Evolução por objetivo
/app/clinica/pacientes/:id/atividades  Prescrever atividade para casa
/app/clinica/pacientes/:id/relatorio   Emitir relatório de evolução

/app/coordenacao         Painel de indicadores da clínica
/app/coordenacao/planos  Validar planos terapêuticos
/app/coordenacao/auditoria             Registro de auditoria

/app/admin/usuarios      Gerenciar usuários e perfis

/app/familia             Painel da família
/app/familia/atividades/:id            Atividade em casa
/app/familia/consentimento             Autorizar e revogar acesso da escola

/app/escola/:pacienteId                Cartão de estratégias
/app/escola/:pacienteId/ocorrencia     Registrar ocorrência

/app/conta               Perfil e preferências
/app/ajuda               Central de acessibilidade e ajuda
```

Mantenha `HashRouter`. É o que faz o GitHub Pages funcionar sem configuração de
servidor. Os endereços terão `#` — isso é proposital.

## 3. Estrutura de pastas

```
src/
├── main.tsx
├── App.tsx                    Rotas raiz: site e app
├── index.css                  Tokens e base
│
├── site/                      Site comercial
│   ├── LayoutSite.tsx
│   ├── componentes/
│   └── paginas/
│
├── app/                       Sistema
│   ├── LayoutApp.tsx
│   ├── clinica/
│   ├── coordenacao/
│   ├── familia/
│   ├── escola/
│   ├── admin/
│   └── conta/
│
├── ui/                        Componentes compartilhados pelos dois
│   ├── Botao.tsx
│   ├── Campo.tsx
│   ├── Cartao.tsx
│   ├── Etiqueta.tsx
│   ├── Aviso.tsx
│   ├── Medidor.tsx
│   ├── Tabela.tsx
│   ├── EstadoVazio.tsx
│   ├── EstadoCarregando.tsx
│   └── EstadoErro.tsx
│
├── graficos/                  Visualizações
│   ├── LinhaEvolucao.tsx
│   ├── BarrasContexto.tsx
│   └── Faixa.tsx
│
├── contexto/
│   ├── Preferencias.tsx       Texto maior, contraste, movimento
│   └── Sessao.tsx             Usuário autenticado e perfil
│
├── servicos/                  CAMADA DE DADOS — ver seção 4
│   ├── tipos.ts
│   ├── contratos.ts
│   ├── mock/
│   ├── api/
│   └── index.ts
│
└── dominio/
    └── regras.ts              Regras de negócio puras e testáveis
```

## 4. A camada de dados

Esta é a decisão de arquitetura mais importante do projeto, e a que mais economiza
retrabalho depois.

### O princípio

Os componentes **nunca** importam dados diretamente. Eles chamam serviços que
retornam `Promise`. Hoje a implementação é falsa; amanhã é a API real. Nenhum
componente muda.

### O contrato

`servicos/contratos.ts` declara as interfaces. Exemplo:

```ts
export interface ServicoPaciente {
  listar(filtro?: FiltroPaciente): Promise<Pagina<PacienteResumo>>
  obter(id: string): Promise<Paciente>
  criar(dados: NovoPaciente): Promise<Paciente>
}
```

### As duas implementações

```
servicos/mock/pacientes.ts   → devolve dados fictícios com latência simulada
servicos/api/pacientes.ts    → faz fetch contra a API real
servicos/index.ts            → escolhe uma das duas
```

```ts
// servicos/index.ts
const usarApi = Boolean(import.meta.env.VITE_API_URL)
export const servicos = usarApi ? servicosApi : servicosMock
```

### Regras que não podem ser quebradas

1. **Toda chamada tem latência simulada** de 200 a 600 ms aleatórios no mock. Sem
   isso os componentes nascem sem estado de carregamento, e o dia em que a API
   entrar a interface vai piscar em branco.
2. **Toda chamada pode falhar.** O mock deve ter um modo de falha acionável por
   variável de ambiente (`VITE_MOCK_FALHA=0.1` falha 10% das vezes), para que os
   estados de erro sejam realmente exercitados durante o desenvolvimento.
3. **Toda listagem é paginada**, mesmo com cinco registros. `Pagina<T>` com
   `itens`, `total`, `pagina`, `porPagina`. Trocar para a API depois não muda a
   assinatura. Séries de gráfico agregadas não são listagens e não são paginadas
   — o gráfico precisa da série inteira; a exceção fica declarada no contrato.
4. **Nenhum componente conhece `servicos/mock`.** Importa sempre de `servicos`.

### Regras de negócio ficam em `dominio/regras.ts`

Funções puras, sem React, sem chamadas de rede. Por exemplo:

```ts
export function objetivoAtingiuCriterio(sessoes: Sessao[], criterio: CriterioDominio): boolean
export function consentimentoVigente(c: Consentimento, agora: Date): boolean
export function escopoPermiteLeitura(c: Consentimento, escopo: EscopoAcesso): boolean
```

São as únicas partes do front que merecem teste unitário agora. São também as que
implementam as regras invioláveis do `CLAUDE.md` — e por isso precisam viver
separadas da interface.

## 5. Autenticação simulada

Não há back-end. A sessão é simulada, mas o **comportamento** é real:

- `contexto/Sessao.tsx` guarda o usuário e o perfil ativo.
- A tela `/app/entrar` oferece quatro perfis de demonstração: Terapeuta,
  Coordenador Clínico, Responsável e Professor. Escolher um define a sessão.
- Rotas do app são protegidas por `<ExigePerfil perfis={['TERAPEUTA']}>`. Sem
  sessão, redireciona para `/app/entrar`.
- **O redirecionamento não é segurança.** Deixe isso escrito em comentário no
  código: a verificação real acontece no servidor, e o servidor ainda não existe.

Quando a API entrar, `Sessao.tsx` troca de fonte e o resto continua igual.

## 6. Dados de demonstração

Cinco pacientes, três profissionais, duas escolas. Não um.

Uma lista com um item não exercita paginação, busca, filtro, ordenação nem estado
vazio — e é exatamente por isso que interfaces construídas sobre um registro
quebram quando encontram trinta.

Os dados ficam em `servicos/mock/dados.ts`, tipados pelos mesmos tipos da API.
Todos fictícios. Nenhum dado de pessoa real, em nenhuma hipótese, nem em ambiente
de desenvolvimento.
