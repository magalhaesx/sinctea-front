# 02 · Design system

Os valores desta página são normativos. Não invente cor, tamanho ou espaçamento
fora do que está aqui.

---

## 1. Cor

### Áreas

A paleta foi **validada por cálculo**, não escolhida por gosto. Foram verificados
seis critérios: faixa de luminosidade, saturação mínima, separação entre pares
adjacentes na visão normal, separação sob deuteranopia, separação sob tritanopia e
contraste contra a superfície.

| Área | Marca | Texto sobre claro | Fundo suave |
|---|---|---|---|
| Clínica | `#00A2AF` | `#0A6C75` | `#E2F4F6` |
| Família | `#C8402E` | `#96301F` | `#FBEAE6` |
| Escola | `#BF8506` | `#8A5F04` | `#FBF1DC` |

Separação mínima: ΔE 14,7 sob deuteranopia, 15,9 na visão normal.

### Dois papéis, duas famílias

Cada área tem duas cores, e elas não são intercambiáveis:

| Família | Onde se usa | Piso que cumpre |
|---|---|---|
| Marca (`#00A2AF`, `#C8402E`, `#BF8506`) | Manchas de identidade sem texto em cima: trilhos, barras de medidor, pontos de legenda, faixas laterais, ícones | 3:1 contra a superfície e separação para daltonismo |
| Tinta (`#0A6C75`, `#96301F`, `#8A5F04`) | Qualquer superfície que receba texto, inclusive fundo de botão preenchido, e texto colorido sobre fundo claro | 4,5:1 com texto branco |

A cor de marca reprova como fundo de botão: `#00A2AF` dá 3,09:1 e `#BF8506` dá
3,19:1 com texto branco, abaixo do critério 1.4.3 da WCAG. O texto de botão tem
15px em negrito e não se qualifica como texto grande.

A família de tinta não substitui a de marca em gráficos e etiquetas onde a cor
carrega identidade sozinha: entre si, `#96301F` e `#8A5F04` separam apenas ΔE 6,0
sob deuteranopia. Em botões isso não é problema porque o rótulo em texto já
distingue.

> A primeira combinação, escolhida esteticamente, **reprovou** no teste. Se você
> precisar de uma quarta cor de área, revalide o conjunto inteiro antes de usar.

### Superfícies e tinta

```
fundo    #F2F6F6      tinta    #132226   principal
sup      #FFFFFF      tinta2   #4E656B   secundária — o mais claro permitido para texto
sup2     #E9F0F0      tinta3   #6F868B   somente controles inativos
linha    #D2DFE0
```

Os neutros são levemente frios, puxados para o azul-petróleo das áreas. Cinza puro
lê como não escolhido.

Só existem duas cores de texto. Acima do piso de 4,5:1 não há espaço para um terceiro
cinza que o leitor distinga do segundo: o mais claro que passa em todas as superfícies
fica a 1,19:1 do `tinta2`.

O `tinta3` serve apenas a componentes inativos, que o critério 1.4.3 da WCAG isenta
expressamente de exigência de contraste. Nunca a texto ativo.

Para fazer texto recuar, use tamanho e peso, não uma cor mais clara. A trilha de
navegação recua por ter 13px contra os 15px do corpo, não por ser mais apagada. Essa é
a única forma de hierarquia disponível quando o contraste já está no limite.

### Estado

Reservadas. **Nunca use uma cor de estado como cor de área, nem o contrário.**

| Estado | Cor | Fundo | Como texto | Como mancha |
|---|---|---|---|---|
| ok | `#1F7A4D` | `#E4F2EA` | 4,61:1 | 5,32:1 |
| atenção | `#8F6000` | `#FBF0D8` | 4,83:1 | 5,47:1 |
| crítico | `#B22E22` | `#FBE9E6` | 5,41:1 | 6,35:1 |

**Um valor por estado, não dois.** Diferente das áreas, aqui não existe família de
marca separada: as cores de estado nunca dependem de cor sozinha — sempre trazem
símbolo e rótulo em texto —, então não estão presas à faixa de luminosidade que a
validação para daltonismo impõe. Um valor que cumpre o piso de texto de 4,5:1 serve
também como mancha, onde o piso é 3:1.

### Cromo

A moldura escura do sistema — cabeçalho e menu lateral.

```
cromo #16272B · cromo2 #1E3338 · linha #2C464C · tinta #E8F1F2 · tinta2 #9DB6BA
```

### A regra que não se negocia

**Nenhuma informação é transmitida apenas por cor.** Todo estado carrega símbolo e
rótulo em texto: `✓ Concluída`, `● Em aberto`, `○ Agendada`, `▲ Atenção`.

Teste: imprima a tela em preto e branco. Se alguma informação sumiu, está errado.

### Todo token declara papel e piso

Nenhuma cor entra nesta página sem dizer **para que serve** e **qual piso cumpre**.
Nomear pelo significado — "atenção", "marca da clínica" — não basta: quem implementa
precisa saber se aquela cor pode receber texto em cima.

Onde o papel não está declarado, a implementação escolhe por conta e às vezes erra.
Três defeitos de contraste neste projeto tiveram exatamente essa origem.

Ao acrescentar um token: diga onde se usa, onde não se usa, e o contraste medido nas
superfícies em que ele aparece.

## 2. Tipografia

**Atkinson Hyperlegible** em toda a interface, incluindo o site comercial.
Desenvolvida pelo Braille Institute of America para baixa visão: diferencia
caracteres confundíveis por variação de forma, não de espessura.

Não acrescente uma segunda família. A unidade tipográfica é a identidade do
produto.

### Escala

| Papel | Tamanho | Peso | Onde |
|---|---|---|---|
| Título de tela | 24px | 700 | Um por tela, sempre `h1` |
| Seção | 18px | 700 | `h2` |
| Subseção | 15px | 700 | `h3` |
| Corpo | 15px | 400 | Padrão |
| Apoio | 13,5px | 400 | Legendas, dicas |
| Etiqueta | 12px | 700 | Pílulas de estado |
| Nota | 11px | 400 | Rodapé de tabela |

Entrelinha 1,55 no corpo, 1,25 em títulos. Linha de leitura em no máximo 65
caracteres — no site comercial isso importa mais que no sistema.

Números em coluna recebem `font-variant-numeric: tabular-nums`. Sem exceção.

## 3. Espaçamento

Escala de 4: `4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48`.

Espaçamento entre irmãos vem de `gap` em flex ou grid — nunca de margem
individual, que colapsa e dobra sem avisar.

Respiro lateral mínimo de 16px em qualquer largura, definido uma vez no invólucro.

## 4. Componentes

### Estados obrigatórios

Todo componente que busca dados tem **quatro** estados, e os quatro precisam
existir antes de a tela ser considerada pronta:

| Estado | O que mostra |
|---|---|
| Carregando | Esqueleto com a forma do conteúdo, nunca um giro genérico no meio da tela |
| Vazio | O que é a lista, por que está vazia e qual a ação para preenchê-la |
| Erro | O que falhou, em linguagem de gente, e um botão de tentar de novo |
| Preenchido | O conteúdo |

Estado vazio ruim: "Nenhum registro encontrado."
Estado vazio bom: "Nenhum paciente cadastrado ainda. Cadastre o primeiro para
começar a montar o plano terapêutico." + botão.

### Inventário

| Componente | Variantes | Observação |
|---|---|---|
| `Botao` | primária, secundária, grande, destrutiva | Altura mínima 44px sempre |
| `Campo` | texto, área, data, seleção, marcação | Rótulo associado é obrigatório |
| `Cartao` | com e sem faixa lateral de área | |
| `Etiqueta` | ok, atenção, crítico, neutro | Sempre símbolo + texto |
| `Aviso` | os mesmos quatro tons | Faixa lateral de 4px |
| `Medidor` | por área | `role="meter"` com rótulo |
| `Tabela` | | `caption`, `th scope`, rolagem própria |
| `EstadoVazio` | | Título, explicação e ação |
| `EstadoCarregando` | | Esqueleto, não giro |
| `EstadoErro` | | Mensagem e "tentar de novo" |
| `Trilha` | | "Você está em: …" |
| `Paginacao` | | |
| `BarraPreferencias` | | Texto maior, contraste, movimento |

### Alvos de toque

**44px de altura mínima.** A norma exige 24px; usamos o dobro porque terapeuta e
professor operam com atenção dividida — um com a criança à frente, o outro com a
turma sob responsabilidade.

## 5. Gráficos

- Série única não leva legenda; o título nomeia a série.
- Duas séries ou mais: legenda sempre presente, e até quatro também rotuladas
  diretamente.
- **Todo gráfico tem alternativa em tabela**, acionável por um botão "Ver como
  tabela". Não é enfeite: é o critério 1.1.1 da WCAG e as recomendações 3.9 e 3.10
  do e-MAG.
- Nunca dois eixos verticais. Duas medidas de escalas diferentes viram dois
  gráficos.
- Grade recessiva, marcas finas, rótulo direto só onde importa — nunca um número
  em cada ponto.
- O texto do gráfico usa as cores de tinta, nunca a cor da série.

## 6. Acessibilidade — o piso de toda tela nova

Antes de considerar qualquer tela pronta, verifique os onze itens:

1. `lang="pt-BR"` no elemento que contém a aplicação
2. Link "Pular para o conteúdo" como primeiro elemento focalizável
3. Marcos semânticos: `header`, `nav`, `main`, `aside`
4. Um `h1` por tela, hierarquia sem salto de nível
5. Foco visível de 3px com afastamento de 2px em todo elemento operável
6. Todo campo com rótulo associado e instrução contextual quando necessário
7. Erro descrito em texto, nomeando o que falta, com foco devolvido ao campo
8. Contraste de 4,5:1 no texto e 3:1 em elementos não textuais
9. Nenhuma informação apenas por cor
10. Sem rolagem horizontal a 400px de largura
11. `prefers-reduced-motion` respeitado, além da preferência do produto

### Preferências do usuário

Três, sempre acessíveis no topo:

| Preferência | Efeito |
|---|---|
| Texto maior | `--escala-texto: 1.2` — amplia tudo em 22% sem quebrar leiaute |
| Alto contraste | Troca o conjunto de tokens pela classe `.contraste` |
| Reduzir animação | Classe `.sem-animacao` zera durações |

Implementadas por token, nunca por sobrescrita pontual de componente.

## 7. Voz da interface

Escreva do lado do usuário, não do sistema.

| Não escreva | Escreva |
|---|---|
| Sincronizar registros pendentes | 3 registros aguardando sincronização — nada se perde |
| Consentimento revogado | O acesso foi encerrado pela família |
| Erro ao salvar | Não foi possível salvar. Tente de novo em alguns segundos |
| Nenhum registro | Nenhum paciente cadastrado ainda |
| Submeter | Registrar e avisar a terapeuta |

O rótulo do botão nomeia exatamente o que acontece ao acioná-lo. Se o botão diz
"Publicar", o aviso depois diz "Publicado".

### Na área da escola, vocabulário não interpretativo

O professor **relata o que observou**. A leitura clínica é do profissional
habilitado. Ocorrência escolar entra no sistema como *evento comportamental
preliminar*. Nada de vocabulário que atribua causa, intenção ou culpa.
