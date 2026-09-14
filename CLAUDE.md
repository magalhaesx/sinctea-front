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
| `docs/04-SITE-COMERCIAL.md` | Ao trabalhar nas páginas públicas |
| `docs/05-ROTEIRO-CLAUDE-CODE.md` | A ordem das etapas de implementação |
| `docs/PROMPT.md` | O prompt que originou a interface (entrega acadêmica) |
| `docs/USO-DA-IA.md` | Como a IA foi empregada, e onde errou |

---

## 1. O que o sistema é

Sistema de informação web (PWA, offline-first) para gestão e acompanhamento
terapêutico de pessoas com Transtorno do Espectro Autista, em contexto
multidisciplinar.

O diferencial não é a clínica: é a **continuidade entre os três ambientes** em que
a pessoa vive — clínica, casa e escola. O sistema não faz diagnóstico e não
substitui julgamento profissional.

**Fundamento:** segundo o Mapa Autismo Brasil (Instituto Autismos, 2026), 56,5% das
pessoas com TEA recebem no máximo duas horas semanais de terapia e 16,4% não
recebem nenhuma. A maior parte do tempo de vigília transcorre fora do ambiente
terapêutico.

O repositório contém **duas coisas**: o site comercial em `/` e o sistema em
`/app`. Compartilham design system e deploy. Ver `docs/01-ARQUITETURA.md`.

### Fora de escopo, declarado
Módulo financeiro, faturamento e TISS · homologação RNDS · aplicativos nativos ·
telessupervisão com vídeo · correlação de contexto com aprendizado de máquina ·
integração com wearables.

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

1. **Quem autoriza o acesso da escola é o Responsável — nunca a escola.** O
   professor cria conta a partir de convite de uso único, com expiração em 72
   horas. Não existe autocadastro de professor.

2. **Nenhum dado atravessa a fronteira do contexto clínico sem verificação de
   consentimento vigente e de escopo.** A verificação ocorre a cada leitura, antes
   de qualquer retorno de dado. É o UC21 e o passo 15 do diagrama de sequência.

3. **A escola nunca acessa evolução, plano terapêutico, diagnóstico, laudo ou
   histórico de sessões.** Restrição de estrutura de dados, não de tela.

4. **Todo objetivo tem duas redações gravadas separadamente:** `descricaoTecnica`
   (equipe) e `descricaoAcessivel` (família e escola). A acessível é escrita pelo
   terapeuta — **nunca gerada automaticamente**. Não crie botão que a gere.

5. **A revogação de consentimento produz efeito imediato.** Sem carência, sem cache
   que sobreviva a ela.

6. **Auditoria em três momentos:** concessão de acesso, leitura autorizada de dado
   sensível e **tentativa de acesso negada**. Registro imutável.

### Vocabulário obrigatório
O professor **relata o que observou**; a **leitura clínica é do profissional
habilitado**. Ocorrência da escola entra como *evento comportamental preliminar*.
Nada de vocabulário interpretativo ou culpabilizante na área da escola.

## 4. Modelo de dados

20 classes. Diagrama completo em `docs/uml/`.

```
Usuario ◁── Profissional | Responsavel | ProfessorAEE      (herança: autenticação única)
Usuario 1─* RegistroAuditoria
Paciente 1─* Sessao        Sessao *─1 Profissional          ("conduzida por")
Paciente 1─* PlanoTerapeutico
PlanoTerapeutico ◆─* Objetivo        (composição: objetivo não existe sem plano)
Objetivo ◆─1 CriterioDominio
Objetivo 1─* AtividadeCasa | CartaoEstrategia
AtividadeCasa 1─* ExecucaoAtividadeCasa *─1 Responsavel
Responsavel 1─* Consentimento 1─* VinculoEscolar 1─* OcorrenciaEscolar
VinculoEscolar *─1 Escola | ProfessorAEE
OcorrenciaEscolar ⇢ OcorrenciaComportamental   («gera»)
Paciente 1─* OcorrenciaComportamental
Sessao 1─* RegistroAtividade *─1 Objetivo
```

A cadeia `Consentimento → VinculoEscolar → OcorrenciaEscolar` é o que torna a regra
2 difícil de burlar: sem consentimento não há vínculo, sem vínculo não há
ocorrência. **Não crie atalhos que contornem essa cadeia.**

## 5. Stack

| Camada | Tecnologia | Situação |
|---|---|---|
| Front-end | React 18 + TypeScript + Vite + TailwindCSS | Em construção |
| Dados | Camada de serviços com implementação simulada | Ver `docs/01` seção 4 |
| Back-end | NestJS + Node.js 20 | Previsto, S06 |
| Banco | PostgreSQL 16 + Prisma | Previsto, S06 |
| Fila | Redis + BullMQ | Previsto |

Qualidade: ISO/IEC 25010:2023. Método: Kanban com limites de trabalho em progresso.

## 6. Convenções

- **Identificadores em português sem acento**, seguindo o diagrama de classes:
  `descricaoTecnica`, `VinculoEscolar`. Comentários em português.
- **Nomes de classe exatamente como no diagrama.** `CartaoEstrategia`, não
  `CartaEstrategia`.
- Atributos na UML na forma `nome : Tipo`.
- Commits em português, imperativo, referenciando o caso de uso:
  `feat(UC15): consulta do cartao de estrategias`.
- **Nunca gravar dado pessoal real**, nem em desenvolvimento. Os dados de
  demonstração são fictícios e permanecem assim.
- Nenhum componente importa de `servicos/mock`. Importa sempre de `servicos`.

## 7. Estado atual

**Concluído**
- Pré-projeto entregue em 17/08 — não pode mais ser alterado
- Alinhamento aos 5 eixos · cronograma de 13 semanas · quadro Kanban
- Modelagem UML: casos de uso, classes, sequência
- Documento de IHC e UX/UI com avaliação heurística e conformidade
- Front-end com 12 rotas, dados fixos no código

**Em construção**
- Camada de dados simulada · site comercial · telas de coordenação e administração

**Próximo, pelo cronograma**
- S02 (atrasado) — documento de requisitos com matriz de rastreabilidade
- S03 — BPMN do fluxo atual e proposto
- S05 — C4 nos três níveis, diagrama de estados do Objetivo, segundo diagrama de
  sequência (sincronização offline)
- S06 — DER, dicionário de dados, publicação em nuvem

**Pendências conhecidas do modelo**
- Não existe entidade de registro funcional; a justificativa da meta 8.5 da ODS 8
  depende dela ou precisa ser reescrita
- Trilha de Autonomia movida para trabalhos futuros

## 8. Divisão de trabalho entre as duas sessões de IA

| | Onde | O quê |
|---|---|---|
| **Cowork** | Aplicativo desktop, na nuvem | Documentação, diagramas, textos, decisões de projeto |
| **Claude Code** | Terminal, nesta pasta | Implementação, testes, git |

Documento novo, diagrama novo ou decisão de arquitetura: vai para o Cowork. Código:
vem para cá. Se durante a implementação aparecer uma contradição na documentação,
**não a resolva por conta própria** — registre e leve ao Cowork.
