# SINCTEA — Sistema Integrado de Continuidade Terapêutica no TEA

Trabalho de Conclusão de Curso · Sistemas de Informação · Centro Universitário FAMETRO

> A informação acompanha a pessoa, não a instituição.

**Autores:** Eduardo da Cruz Monteiro (2382960) · Lucas Magalhães Pinto (2394090)
**Orientadora:** Profa. Luana Leal · **Semestre:** 2026/2

**Endereço:** <https://sinctea.onrender.com>. O servidor gratuito dorme depois de 15
minutos sem acesso, e o primeiro acesso depois disso leva cerca de um minuto.

---

## O problema

Segundo o Mapa Autismo Brasil (Instituto Autismos, 2026), 56,5% das pessoas com
Transtorno do Espectro Autista recebem no máximo duas horas de terapia por semana, e
16,4% não recebem nenhuma. A maior parte do tempo de vigília transcorre fora da
clínica, e o que se trabalha lá não se generaliza sozinho para casa e para a escola.

O SINCTEA não é um sistema de gestão de clínica. Ele faz a informação terapêutica
acompanhar a pessoa pelos três ambientes em que ela vive — clínica, casa e escola —,
com a família controlando cada passagem de informação para a escola.

## O que funciona hoje

O sistema é real: front-end e servidor publicados, banco PostgreSQL, contas com senha.
**Ele começa vazio.** Nenhum registro vem pré-carregado; tudo é cadastrado pelas telas.

| Área | O que já funciona |
|---|---|
| Administração | Cadastro da equipe, perfis, desativação e link de primeiro acesso |
| Clínica | Pacientes, responsáveis, plano terapêutico com objetivos e validação pela coordenação, cartão de estratégias, registro de sessão, avisos da escola e eventos comportamentais com a leitura clínica |
| Família | Filhos e objetivos em linguagem acessível; autorizar, acompanhar e encerrar o acesso da escola; cadastrar a escola |
| Escola | Aceite do convite, lista de alunos, cartão de estratégias e registro de ocorrência |

Indicadores, relatórios de evolução, a evolução por objetivo, atividades de casa, o
registro de ocorrência na sessão, a tela de auditoria e a agenda entram em seguida. Até
lá, ficam fora da versão publicada — nunca aparecem com dado simulado.

### Do zero, pelas telas

1. O primeiro administrador é criado uma vez, por um comando no computador de quem
   mantém o sistema, porque nenhuma tela pode criar administrador num endereço público.
2. O administrador cadastra a terapeuta e a coordenação; cada pessoa define a própria
   senha por um link de uso único.
3. A terapeuta cadastra o paciente e o responsável, cria o plano, escreve o objetivo
   nas duas redações e o cartão de estratégias, e envia para validação.
4. A coordenação aprova o plano.
5. O responsável legal autoriza uma escola, com escopo e validade, e entrega o convite.
6. O professor aceita o convite e lê o cartão de estratégias — e só ele.
7. Se a família encerra o acesso, a leitura seguinte da escola já é negada.

## Aviso

**Ambiente acadêmico. Não cadastre dados de pacientes reais.** Dado de saúde de criança
exige consentimento do responsável (LGPD, arts. 11 e 14), e o servidor fica nos
Estados Unidos (art. 33). O sistema não faz diagnóstico e não substitui o julgamento
profissional.

## As seis regras, e onde são garantidas

| Regra | Garantia |
|---|---|
| 1. Quem autoriza a escola é o responsável legal, nunca a escola. Qualquer responsável vinculado pode encerrar | Serviço do servidor, provado por teste de integração |
| 2. Nenhum dado sai da clínica sem consentimento vigente e escopo, verificados a cada leitura | Serviço do servidor, a cada leitura, por teste |
| 3. A escola nunca acessa evolução, plano, diagnóstico ou histórico | Projeção explícita do cartão, por teste |
| 4. Todo objetivo tem duas redações, e a acessível é escrita pelo terapeuta | Modelo de dados e validação |
| 5. Encerrar o acesso vale na hora | Verificação a cada leitura, por teste |
| 6. Toda leitura e escrita de dado do paciente, e toda tentativa negada, é registrada | Interceptador do servidor; *trigger* no PostgreSQL recusa alterar ou apagar a auditoria |

Cada regra foi quebrada de propósito para confirmar que o teste falha. O registro está
em `docs/06-VERIFICACAO-DAS-REGRAS.md`, inclusive as quebras que não derrubaram teste.

Além delas: senha guardada só em argon2id; sessão no servidor com cookie `httpOnly`;
links e convites de uso único guardados só como resumo SHA-256; limite de tentativas
de entrada; a aplicação conecta ao banco com um papel que não é dono das tabelas.

## Arquitetura

| | |
|---|---|
| Front-end | React 18, TypeScript, Vite, Tailwind CSS |
| Servidor | NestJS sobre Node.js 22 |
| Banco | PostgreSQL 17 com Prisma, hospedado no Neon |
| Hospedagem | Render: o mesmo endereço serve o front e a API em `/api` |

Um repositório, três pacotes (*npm workspaces*):

```
/                 front-end
compartilhado/    tipos, contratos e regras de domínio — o mesmo código nos dois lados
servidor/         API NestJS, esquema Prisma e migrações
docs/             documentação do projeto
```

A cada envio para a `main`, o GitHub Actions roda os testes contra um PostgreSQL 17,
constrói e executa a imagem Docker, e aplica as migrações no banco. Só então o Render
publica.

## Como rodar localmente

Requer Node.js 22.

```bash
npm install
npm test      # front, compartilhado e servidor; o servidor sobe o próprio PostgreSQL descartável
```

**O sistema real na máquina**, com a API e um banco local. No primeiro terminal, que
fica aberto:

```bash
cp servidor/.env.exemplo servidor/.env   # o banco embutido já vem configurado
npm run banco -w @sinctea/servidor       # PostgreSQL 17 embutido, sem instalação
```

No segundo:

```bash
npm exec -w @sinctea/servidor -- prisma migrate deploy   # as migrações no banco local
npm run criar-administrador -w @sinctea/servidor         # o primeiro administrador
npm run build -w @sinctea/servidor
npm start -w @sinctea/servidor                           # a API em http://localhost:3000/api
```

No terceiro, depois de criar na raiz um arquivo `.env.api` com a linha
`VITE_API_URL=/api`:

```bash
npm run dev -- --mode api   # o front em http://localhost:5173, falando com a API
```

Sem `--mode api`, `npm run dev` abre a versão simulada, com dados fictícios e entrada
de demonstração: ela existe para desenvolver as telas antes de o serviço chegar ao
servidor, e não vai para a versão publicada.

## Documentação

| Documento | Conteúdo |
|---|---|
| `docs/01-ARQUITETURA.md` | Pacotes, camadas, rotas e mapeamento para o banco |
| `docs/02-DESIGN-SYSTEM.md` | Tipografia, cores validadas, componentes e acessibilidade |
| `docs/03-TELAS-SISTEMA.md` | Especificação de cada tela |
| `docs/06-VERIFICACAO-DAS-REGRAS.md` | O que cada teste prova, e as quebras deliberadas |
| `docs/07-BACKEND.md` | Decisões do servidor e o plano de etapas |
| `docs/08-ADERENCIA-AO-PRE-PROJETO.md` | O que o pré-projeto prometeu, e o estado de cada item |
| `docs/09-DICIONARIO-DE-DADOS.md` | Dicionário de dados, gerado do banco |
| `docs/uml/` | Diagrama de classes e DER |
| `docs/USO-DA-IA.md` | Como a IA foi empregada, e onde errou |

## Acessibilidade

Tipografia Atkinson Hyperlegible; cor de cada área validada por cálculo para
daltonismo; nenhuma informação depende só de cor; alvos de toque de 44 px; texto
maior, alto contraste e redução de movimento escolhidos pelo próprio usuário.
Referências: WCAG 2.2 AA, e-MAG 3.1, W3C COGA e o guia GAIA. O detalhe está em
`docs/02-DESIGN-SYSTEM.md`.
