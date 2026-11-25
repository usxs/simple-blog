# 后端镜像（V2）：Node 22 Alpine + 内置 node:sqlite + sharp（上传图片自动转 WebP）
# node:sqlite 是 Node 22.5 起内置的模块，所以这个版本不再需要装数据库驱动。
# sharp 自带各平台预编译二进制（含 Alpine musl），无需安装编译工具链。
FROM node:22-alpine

WORKDIR /app

# 先装依赖：利用 Docker 层缓存，日常改代码重建镜像时不会重新下载 sharp
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

# 再拷代码（数据目录 config.json/article/Musings/img/file/data 由 compose 卷挂载，不进镜像）
COPY server.js admin.js admin.html admin.css markdown.js ./
COPY backend ./backend
COPY scripts ./scripts

# SQLite 数据目录（compose 会把这个目录挂到宿主机，升级镜像不丢数据）
RUN mkdir -p /app/data && chown -R 1000:1000 /app

# 让容器内非 root 用户拥有 /app，便于写临时文件（config.json 是单文件挂载，写入走兜底路径）
RUN chown -R 1000:1000 /app

ENV NODE_ENV=production
EXPOSE 33001

# 与宝塔 www 用户对齐（UID/GID 1000），上传与文章文件不会生成 root 权限文件
USER 1000:1000

CMD ["node", "server.js"]
