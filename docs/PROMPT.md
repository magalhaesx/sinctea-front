# Prompt utilizado para a geração da interface

Documento referente ao item 6 da orientação: *Criar Prompt para Design UX/UI com IA*.

Registra-se aqui o prompt estruturado que orientou a construção do front-end, e não um
prompt genérico. Ele foi escrito **depois** do pré-projeto, dos requisitos e da modelagem
UML — essa ordem é deliberada e está explicada em `USO-DA-IA.md`.

---

## Por que este prompt tem esta forma

Um prompt curto do tipo *"crie uma interface bonita para um sistema de autismo"* devolve
uma interface plausível e genérica. O que diferencia o resultado não é a formulação
bonita do pedido: é a quantidade de **restrição verdadeira** que o prompt carrega.

Por isso o prompt abaixo é organizado em cinco blocos: papel, contexto verificável,
regras invioláveis, restrições técnicas e critério de aceitação. Os três últimos são os
que fazem diferença — são eles que impedem a IA de inventar telas que contrariam o
projeto já aprovado.

---

## O prompt

> **Papel**
>
> Você é especialista em UX/UI Design, acessibilidade digital e desenvolvimento
> front-end. Trabalhe como projetista, não como executor: aponte contradições entre o
> que eu peço e o que o projeto já define, antes de escrever código.
>
> **Contexto**
>
> Analise os documentos anexados — pré-projeto, documento de requisitos e diagramas UML
> de casos de uso, classes e sequência — e extraia: o problema, o público-alvo, os
> objetivos e as regras de negócio. O sistema é o SINCTEA, um sistema de continuidade
> terapêutica para pessoas com Transtorno do Espectro Autista, que liga três contextos:
> clínica, casa e escola.
>
> São três perfis com necessidades opostas, e a interface precisa refletir essa
> diferença:
> - **Terapeuta** — registra durante o atendimento, com a criança à frente, de pé, com
>   uma das mãos ocupada, às vezes sem internet. Precisa de densidade alta e de um toque
>   por registro.
> - **Responsável** — consulta no celular, no fim do dia, cansado, frequentemente sem
>   formação em saúde. Precisa de linguagem cotidiana e de uma decisão por tela.
> - **Professor/AEE** — consulta em sala, no intervalo entre duas atividades, com a
>   turma sob sua responsabilidade. Tem poucos segundos.
>
> **Regras invioláveis**
>
> Se algum pedido meu conflitar com uma destas regras, pare e me avise em vez de decidir
> sozinho:
> 1. Quem autoriza o acesso da escola é o responsável, nunca a escola. O professor entra
>    por convite de uso único.
> 2. Nenhum dado atravessa a fronteira do contexto clínico sem verificação de
>    consentimento vigente e de escopo.
> 3. A escola nunca acessa evolução, plano terapêutico, diagnóstico, laudo ou histórico
>    de sessões.
> 4. Todo objetivo terapêutico tem duas redações gravadas separadamente: a técnica, para
>    a equipe, e a acessível, para família e escola. A acessível é escrita pelo
>    terapeuta, nunca gerada automaticamente a partir da técnica.
> 5. A revogação de consentimento produz efeito imediato.
> 6. O professor relata o que observou; a leitura clínica é do profissional habilitado.
>    Nenhum vocabulário interpretativo ou culpabilizante na área da escola.
>
> **Restrições técnicas e de acessibilidade**
>
> - React 18 + TypeScript + Vite + Tailwind CSS, componentes reutilizáveis, sem
>   biblioteca de componentes pronta.
> - WCAG 2.2 nível AA e e-MAG 3.1 como piso, não como meta: marcos semânticos,
>   hierarquia de títulos sem salto, link de salto para o conteúdo, rótulo associado a
>   todo campo, foco visível de 3 px, erro descrito em texto nomeando o que falta,
>   alternativa em tabela para todo gráfico, `lang="pt-BR"`.
> - Acessibilidade cognitiva conforme W3C COGA e o guia GAIA: linguagem literal sem
>   metáfora, previsibilidade de posição, ausência de estímulo desnecessário, nenhuma
>   animação automática.
> - Nenhuma informação transmitida apenas por cor: todo estado carrega símbolo e rótulo
>   em texto.
> - Alvo de toque mínimo de 44 px de altura.
> - Paleta de cores validada por cálculo para deficiência de visão de cores, com
>   separação mínima de ΔE 8 sob deuteranopia e tritanopia.
> - Preferências sensoriais controladas pelo usuário: texto maior, alto contraste e
>   redução de movimento.
>
> **Estrutura pedida**
>
> Crie a estrutura de telas a partir dos casos de uso, não a partir de um layout
> genérico, e indique em cada tela qual caso de uso ela implementa. Sugira os
> componentes necessários e justifique cada decisão de design pelo contexto de uso do
> perfil correspondente — não por preferência estética.
>
> **Critério de aceitação**
>
> Ao final, liste: (a) quais critérios da WCAG 2.2 foram efetivamente implementados e
> onde; (b) quais heurísticas de Nielsen a interface atende e quais ela ainda viola, com
> severidade; (c) o que você deixou de fora e por quê. Não afirme conformidade que o
> código não sustenta.

---

## O que este prompt produziu

O último bloco — *critério de aceitação* — é o que mais alterou o resultado. Ao exigir a
lista de heurísticas **violadas**, e não apenas das atendidas, a avaliação heurística
deixou de ser uma lista de elogios e passou a apontar seis problemas reais, dois deles
de severidade 3:

- registro de tentativa sem possibilidade de desfazer;
- encerramento do acesso da escola sem confirmação, sendo ação destrutiva de efeito
  imediato.

Ambos foram corrigidos no código: a tela de registro de sessão tem "Desfazer o último
registro" e a tela de consentimento tem confirmação em duas etapas.

Sem essa exigência explícita no prompt, os dois defeitos teriam passado.
