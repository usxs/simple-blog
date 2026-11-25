# 后端镜像：Node 20 Alpine + sharp（上传图片自动转 WebP 用）
# sharp 自带各平台预编译二进制（含 Alpine musl），无需安装编译工具链。
# 依赖在构建机架构（BUILDPLATFORM）上安装，并按目标架构选择 sharp 二进制，
# 避免在 QEMU 下执行 npm 触发 Node SIGILL（arm64 构建常见问题）。
FROM --platform=$BUILDPLATFORM node:20-alpine AS deps

WORKDIR /app

COPY package.json ./
ARG TARGETARCH
RUN case "$TARGETARCH" in \
      amd64) NPM_CPU=x64 ;; \
      arm64) NPM_CPU=arm64 ;; \
      *) NPM_CPU="$TARGETARCH" ;; \
    esac; \
    npm install --omit=dev --no-audit --no-fund --os=linux --cpu="$NPM_CPU" --libc=musl && npm cache clean --force

# 运行时镜像只做拷贝，不在目标架构下执行 RUN，因此不需要 QEMU 跑 Node
FROM node:20-alpine

WORKDIR /app

COPY --from=deps --chown=1000:1000 /app/node_modules ./node_modules
# 数据目录 config.json/article/Musings/img/file/data 由 compose 卷挂载，不进镜像
COPY --chown=1000:1000 server.js admin.js admin.html admin.css markdown.js ./
COPY --chown=1000:1000 backend ./backend

ENV NODE_ENV=production
EXPOSE 33001

# 与宝塔 www 用户对齐（UID/GID 1000），上传与文章文件不会生成 root 权限文件
USER 1000:1000

CMD ["node", "server.js"]
