# Docker 镜像

三个版本共用同一个镜像仓库：<https://hub.docker.com/r/starspacec/simple-blog-backend>。镜像里已经包含运行所需的一切，**V3 的一个容器同时提供站点和后台**，不需要再部署 Cloudflare Pages。

| 项 | 值 |
| --- | --- |
| 镜像 | `starspacec/simple-blog-backend` |
| 稳定标签 | `latest`（V1）、`v2`（V2）、`v3`（V3） |
| 版本 / SHA 标签 | 打 `v3.0.0` 这类 tag 时产出 `3.0.0`、`3.0`、`3`；每次构建另有短 SHA 标签 |
| 架构 | `linux/amd64`、`linux/arm64` |
| 基础镜像 | `node:22-alpine`（内置 `node:sqlite`，不需要数据库驱动） |
| 用户 | `1000:1000`（非 root） |
| 端口 | `33001` |
| 健康检查 | 每 30s 请求 `/api/auth/status` |

## 一、先选标签

| 标签 | 分支 | 形态 | 启动后得到 |
| --- | --- | --- | --- |
| `latest` | `main` | V1 | Node 后端（Markdown + JSON 文件），前端另发 Pages |
| `v2` | `v2-sqlite` | V2 | Node 后端（SQLite），前端另发 Pages |
| `v3` | `v3-monolith` | V3 | 站点 + 后台同一个容器，不需要 Pages |

稳定标签会跟着分支更新；想固定到某一次构建，用 CI 生成的短 SHA 标签，或在仓库打 tag 后使用 `3.0.0` 这类版本标签。回滚同理。

## 二、直接运行

### V3：一个容器跑完

```bash
mkdir -p blog && cd blog
mkdir -p data img file
sudo chown -R 1000:1000 data img file

docker run -d --name simple-blog --restart unless-stopped \
  -p 127.0.0.1:33001:33001 \
  -v "$PWD/data:/app/data" -v "$PWD/img:/app/img" -v "$PWD/file:/app/file" \
  -e ADMIN_USERNAME=admin -e ADMIN_PASSWORD='换成你自己的强密码' \
  -e SITE_PUBLIC_URL='https://blog.example.com' \
  starspacec/simple-blog-backend:v3
```

- 打开 `http://服务器IP:33001/` 是站点，后台在同域 `/admin`；
- 数据只需要 `data/`（含 `blog.db` 与 WAL 文件）、`img/`、`file/`；
- 不需要 `config.json`、`article/`、`Musings/`，也不需要 `BACKEND_PUBLIC_URL`；
- 生产环境在前面加 Nginx 并配 HTTPS，参考 [域名与 HTTPS](../start/https.md)。

### V2：只跑后端

```bash
mkdir -p blog-backend && cd blog-backend
mkdir -p data img file
sudo chown -R 1000:1000 data img file

docker run -d --name simple-blog-backend --restart unless-stopped \
  -p 127.0.0.1:33001:33001 \
  -v "$PWD/data:/app/data" -v "$PWD/img:/app/img" -v "$PWD/file:/app/file" \
  -e ADMIN_USERNAME=admin -e ADMIN_PASSWORD='换成你自己的强密码' \
  -e SITE_PUBLIC_URL='https://www.example.com' \
  -e BACKEND_PUBLIC_URL='https://api.example.com' \
  starspacec/simple-blog-backend:v2
```

V2 默认 `STORE=sqlite`，数据库是 `data/blog.db`。要沿用文件存储时加 `-e STORE=file`，并补上 `config.json`、`article/`、`Musings/` 三个挂载。

### V1：文件存储

```bash
mkdir -p blog-backend && cd blog-backend
mkdir -p data article Musings img file && touch config.json
sudo chown -R 1000:1000 data article Musings img file config.json

docker run -d --name simple-blog-backend --restart unless-stopped \
  -p 127.0.0.1:33001:33001 \
  -v "$PWD/config.json:/app/config.json" \
  -v "$PWD/article:/app/article" -v "$PWD/Musings:/app/Musings" \
  -v "$PWD/img:/app/img" -v "$PWD/file:/app/file" -v "$PWD/data:/app/data" \
  -e ADMIN_USERNAME=admin -e ADMIN_PASSWORD='换成你自己的强密码' \
  -e SITE_PUBLIC_URL='https://www.example.com' \
  -e BACKEND_PUBLIC_URL='https://api.example.com' \
  starspacec/simple-blog-backend:latest
```

三个版本的完整环境变量见 [环境变量](env.md)；V1 / V2 还要部署前端，见 [部署前端](../start/frontend.md)。

## 三、用 compose 跑镜像（不构建）

各分支的 `backend/docker-compose.hub.yml` 已经按版本写好默认标签和卷。V3：

```bash
mkdir -p data img file && sudo chown -R 1000:1000 data img file
curl -O https://raw.githubusercontent.com/usxs/simple-blog/v3-monolith/backend/docker-compose.hub.yml
curl -o .env https://raw.githubusercontent.com/usxs/simple-blog/v3-monolith/backend/.env.example
vim .env
docker compose -f docker-compose.hub.yml up -d
```

V1 / V2 把分支换成 `main` / `v2-sqlite`，并确认 `.env` 里的 `IMAGE_TAG` 是 `latest` / `v2`。compose 文件自带 `STORE=sqlite`、`DB_FILE` 和健康检查；V3 的 `BACKEND_PUBLIC_URL` 留空即可。

升级只换标签，数据卷不动：

```bash
# 改 .env 里的 IMAGE_TAG，或直接拉取稳定标签
docker compose -f docker-compose.hub.yml pull
docker compose -f docker-compose.hub.yml up -d
```

## 四、从源码构建

本机没有现成镜像，或想改代码时，从对应分支构建：

```bash
git clone -b v3-monolith https://github.com/usxs/simple-blog.git
cd simple-blog/backend
cp .env.example .env
vim .env
docker compose up -d --build
```

把 `v3-monolith` 换成 `v2-sqlite` / `main` 就是 V2 / V1。也可以手动构建：

```bash
cd backend
docker build -t my-blog-backend:dev .
```

!!! note "sharp 与架构"
    镜像在 `npm install` 时拉取对应平台的 `sharp` 二进制；跨架构构建（如在 amd64 机器上构建 arm64）需要 QEMU。GitHub Actions 已用 `docker/setup-qemu-action` 处理，本地跨架构请用 `docker buildx`。

## 五、镜像什么时候发布

三个分支各有自己的 `.github/workflows/docker.yml`，只监听本分支：

| 分支 | 触发 | 稳定标签 |
| --- | --- | --- |
| `main` | `main` 上的 `backend/**` 或工作流变化、`v*` 标签 | `latest` |
| `v2-sqlite` | `v2-sqlite` 上的 `backend/**` 或工作流变化、`v2*` / `2.*` 标签 | `v2` |
| `v3-monolith` | `v3-monolith` 上的 `backend/**` 或工作流变化、`v3*` / `3.*` 标签 | `v3` |

每次构建同时产出 `linux/amd64` 与 `linux/arm64`，推送到 GHCR；仓库变量 `DOCKERHUB_ENABLED=true` 时也推送到 Docker Hub。分支推送产出稳定标签与短 SHA 标签；在对应分支打 `v3.0.0` 这类 tag 时，额外生成 `3.0.0`、`3.0`、`3`，方便固定与回滚。

## 六、检查容器

```bash
docker compose ps                                   # Up (healthy)
docker inspect --format '{{.State.Health.Status}}' simple-blog-backend
docker logs --tail 50 -f simple-blog-backend
docker exec -it simple-blog-backend sh              # 进容器
```

V3 还可以直接确认站点与后台：

```bash
curl -s http://127.0.0.1:33001/api/auth/status
curl -sI http://127.0.0.1:33001/ | head -1
curl -sI http://127.0.0.1:33001/admin | head -1
```

## 下一步

[备份与升级 :material-arrow-right:](../ops/backup.md){ .md-button .md-button--primary }
