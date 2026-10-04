# ---------------------------------------------------------------------------
# JNCTF 单镜像：前端构建产物 + Node 后端一起托管，只需要一个进程、一个端口
# ---------------------------------------------------------------------------
FROM node:22-alpine AS web
WORKDIR /app/web
ARG NPM_REGISTRY=https://registry.npmmirror.com
COPY web/package.json web/package-lock.json* ./
RUN npm install --no-audit --no-fund --registry=$NPM_REGISTRY
COPY web/ ./
RUN npm run build:only

FROM node:22-alpine
ARG NPM_REGISTRY=https://registry.npmmirror.com
ENV NODE_ENV=production \
    PORT=8080 \
    UPLOAD_DIR=/app/data/uploads

RUN apk add --no-cache docker-cli curl

WORKDIR /app
COPY server/package.json server/package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund --registry=$NPM_REGISTRY
COPY server/prisma ./prisma
RUN npx prisma generate

COPY server/ ./
COPY --from=web /app/web/dist ./web/dist

VOLUME ["/app/data"]
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s \
  CMD curl -fsS http://127.0.0.1:8080/api/site/health || exit 1

# 启动前先跑数据库迁移，保证表结构跟代码一致
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
