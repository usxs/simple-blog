# 简单博客后端镜像
# Node 20 Alpine + sharp（上传图片自动转 WebP）。sharp 自带 musl 预编译二进制，无需编译工具链。
FROM node:20-alpine

LABEL org.opencontainers.image.title="简单博客后端" \
      org.opencontainers.image.description="Simple Blog backend: zero-dependency Node service (auth, posts, moments, comments, links, media)" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.url="https://github.com/usxs/simple-blog" \
      org.opencontainers.image.source="https://github.com/usxs/simple-blog"

WORKDIR /app

# 先装依赖：利用层缓存，改代码重建时不必重新下载 sharp
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

# 再拷代码（数据目录由卷挂载，不进镜像）
COPY server.js admin.js admin.html admin.css markdown.js ./
COPY backend ./backend

# 非 root 运行；/app 归 UID 1000 所有，临时文件与兜底写入都落在这里
RUN chown -R 1000:1000 /app

ENV NODE_ENV=production \
    PORT=33001
EXPOSE 33001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/auth/status" >/dev/null 2>&1 || exit 1

USER 1000:1000
CMD ["node", "server.js"]
