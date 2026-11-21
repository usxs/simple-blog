# 后端镜像：Node 20 Alpine + sharp（上传图片自动转 WebP 用）
# sharp 自带各平台预编译二进制（含 Alpine musl），无需安装编译工具链。
FROM node:20-alpine

WORKDIR /app

# 先装依赖：利用 Docker 层缓存，日常改代码重建镜像时不会重新下载 sharp
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

# 再拷代码（数据目录 config.json/article/Musings/img/file/data 由 compose 卷挂载，不进镜像）
COPY server.js admin.js admin.html admin.css markdown.js ./
COPY backend ./backend

ENV NODE_ENV=production
EXPOSE 33001

# 与宝塔 www 用户对齐（UID/GID 1000），上传与文章文件不会生成 root 权限文件
USER 1000:1000

CMD ["node", "server.js"]
