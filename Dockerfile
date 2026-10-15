# Imagem do SINCTEA (docs/07, D3): o Nest servindo a API em /api e o build do
# front na raiz, num endereco so.
#
# Debian slim, e nao Alpine: o argon2 traz binario pronto para glibc.
# Migracao nao roda aqui: e no GitHub Actions, com o papel dono do banco
# (docs/07, D4). Por isso o Prisma CLI fica so no estagio de build.

# ------------------------------------------------------------------ build
FROM node:22-bookworm-slim AS construcao
WORKDIR /app

COPY . .
# O postinstall do servidor gera o cliente do Prisma (servidor/src/gerado).
RUN npm ci
# Sem VITE_API_URL: ate a Etapa 12, o front publicado continua no mock.
RUN npm run build && npm run build:servidor

# ------------------------------------------------------------------ execucao
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production \
    PASTA_DO_FRONT=/app/dist

# So as dependencias de producao do servidor. Sem --omit=optional viria o
# Prisma CLI, dependencia opcional do @prisma/client, e com ele o Studio.
# --ignore-scripts: o postinstall chamaria o CLI, que nao esta aqui; o argon2
# carrega o binario pronto sem script.
COPY package.json package-lock.json ./
COPY compartilhado/package.json compartilhado/
COPY servidor/package.json servidor/
RUN npm ci --omit=dev --omit=optional --workspace @sinctea/servidor --ignore-scripts \
 && npm cache clean --force

COPY --from=construcao /app/compartilhado/dist compartilhado/dist
COPY --from=construcao /app/servidor/dist servidor/dist
COPY --from=construcao /app/dist dist

USER node
EXPOSE 3000
CMD ["node", "servidor/dist/src/main.js"]
