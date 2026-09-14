# SINCTEA — Front-end

Interface do **Sistema Integrado de Continuidade Terapêutica no TEA**, desenvolvida como
Trabalho de Conclusão de Curso do curso de Sistemas de Informação do Centro Universitário
FAMETRO.

> A informação acompanha a pessoa, não a instituição.

**Autores:** Eduardo da Cruz Monteiro (2382960) · Lucas Magalhães Pinto (2394090)
**Orientadora:** Profa. Luana Leal · **Semestre:** 2026/2

---

## O problema

O Censo 2022 identificou 2,4 milhões de pessoas com Transtorno do Espectro Autista no
Brasil. A pesquisa Mapa Autismo Brasil mostrou que **56,5% recebem no máximo duas horas
de terapia por semana** e que **39,9% dos que frequentam escola não contam com apoio
pedagógico**.

A consequência é direta: a maior parte do tempo de vigília transcorre fora do ambiente
terapêutico. O que se trabalha na clínica não se generaliza sozinho para casa e para a
escola.

O SINCTEA não é um sistema de gestão de clínica. É um sistema que faz a informação
terapêutica acompanhar a pessoa pelos ambientes em que ela vive — com o consentimento da
família controlando cada passagem de informação.

## Como rodar

Requer Node.js 20 ou superior.

```bash
npm install
npm run dev      # servidor de desenvolvimento em http://localhost:5173
npm run build    # gera a versão de produção em dist/
npm run preview  # serve a versão de produção localmente
```

## Estrutura

```
src/
├── componentes/     Layout, primitivos de interface e gráfico de evolução
├── contexto/        Preferências sensoriais (texto maior, contraste, movimento)
├── dados/           Dados fictícios de demonstração
├── paginas/         Uma pasta por área de acesso: clinica, familia, escola
├── tipos/           Tipos do domínio, espelhando o diagrama de classes
└── index.css        Tokens de design e estilos de base
docs/
├── PROMPT.md        Prompt usado na geração da interface
└── USO-DA-IA.md     Como a IA foi empregada como agente, e onde errou
```

## As telas

Cada tela implementa um caso de uso já especificado na modelagem UML. A correspondência
aparece no próprio menu da aplicação.

| Rota | Tela | Caso de uso |
|---|---|---|
| `/` | Entrada — escolha da área | — |
| `/sobre` | Apresentação da solução | — |
| `/clinica` | Painel do terapeuta | UC10 · UC04 · UC06 |
| `/clinica/plano` | Plano Terapêutico Individual | UC02 · UC03 |
| `/clinica/sessao` | Registro de sessão | UC04 · UC05 · UC06 |
| `/clinica/evolucao` | Evolução por objetivo | UC08 |
| `/familia` | Painel da família | UC13 |
| `/familia/atividade` | Atividade em casa | UC14 |
| `/familia/consentimento` | Autorizar o acesso da escola | UC11 · UC12 · UC21 |
| `/escola` | Cartão de estratégias | UC15 · UC21 |
| `/escola/ocorrencia` | Registrar ocorrência | UC16 |
| `/acessibilidade` | Acessibilidade e ajuda | — |

### Correspondência com as telas sugeridas na orientação

| Sugestão da orientação | Onde está |
|---|---|
| 1. Tela inicial | `/` — escolha de área |
| 2. Tela de apresentação da solução | `/sobre` |
| 3. Tela principal / dashboard | `/clinica` e `/familia` |
| 4. Tela de cadastro ou interação | `/clinica/sessao`, `/escola/ocorrencia`, `/familia/consentimento` |
| 5. Tela de resultados ou informações | `/clinica/evolucao`, `/escola` |
| 6. Tela de ajuda ou acessibilidade | `/acessibilidade` |

## Decisões de design

**Tipografia.** Toda a interface usa **Atkinson Hyperlegible**, desenvolvida pelo Braille
Institute of America para melhorar a legibilidade de pessoas com baixa visão. Ela
diferencia caracteres confundíveis — "I" maiúsculo, "l" minúsculo e algarismo "1"; "O" e
zero — por variação de forma, não apenas de espessura.

**Cor.** Cada área tem uma cor de identidade, e a paleta foi **validada por cálculo**, não
escolhida por gosto:

| Área | Marca | Texto |
|---|---|---|
| Clínica | `#00A2AF` | `#0A6C75` |
| Família | `#C8402E` | `#96301F` |
| Escola | `#BF8506` | `#8A5F04` |

Separação mínima de ΔE 14,7 sob deuteranopia e 15,9 na visão normal; contraste igual ou
superior a 3:1 contra a superfície. A primeira combinação, escolhida esteticamente,
reprovou no teste e foi substituída.

**Nenhuma informação depende apenas de cor.** Todo estado carrega símbolo e rótulo em
texto — `✓ Concluída`, `● Em aberto`, `○ Agendada`. A interface permanece compreensível
em impressão monocromática, sob daltonismo e no modo de alto contraste.

**Alvos de toque de 44 px** — o dobro dos 24 px exigidos pelo critério 2.5.8 da WCAG 2.2.
A razão é o contexto: terapeuta e professor operam com atenção dividida.

**Dupla redação do objetivo.** Cada objetivo terapêutico tem duas redações gravadas
separadamente. A técnica, para a equipe. A acessível, única que família e escola
enxergam. A alternância pode ser vista em `/clinica/plano`.

## Acessibilidade

Piso, não meta. Implementado e verificável no código:

- 21 critérios da **WCAG 2.2 nível AA**, incluindo quatro novos na versão 2.2
  (2.4.11 foco não obscurecido, 2.5.8 tamanho do alvo, 3.3.7 entrada redundante,
  3.3.8 autenticação acessível)
- 30 recomendações do **e-MAG 3.1**, o Modelo de Acessibilidade em Governo Eletrônico
- Recomendações de acessibilidade cognitiva do **W3C COGA**
- Guia **GAIA** (Britto e Pizzolato), voltado a aspectos do autismo

Recursos oferecidos ao usuário na própria interface: texto maior, alto contraste e
redução de movimento. A página `/acessibilidade` declara o que foi implementado.

## Regras de negócio que a interface respeita

1. Quem autoriza o acesso da escola é o **responsável**, nunca a escola.
2. Nenhum dado atravessa a fronteira do contexto clínico sem verificação de consentimento
   vigente e de escopo.
3. A escola nunca acessa evolução, plano terapêutico, diagnóstico ou histórico de sessões.
4. Todo objetivo tem duas redações, e a acessível é escrita pelo terapeuta.
5. A revogação de consentimento produz efeito imediato.
6. O professor relata o que observou; a leitura clínica é do profissional habilitado.

## Tecnologias

React 18 · TypeScript · Vite · Tailwind CSS · React Router

## Publicação

O site é publicado automaticamente no GitHub Pages a cada envio para a branch `main`,
pelo fluxo em `.github/workflows/deploy.yml`.

## Aviso

Todos os dados exibidos são **fictícios**. Nenhuma informação de pessoa real foi
utilizada. O sistema não realiza diagnóstico e não substitui o julgamento profissional.
