# Docker 镜像

后端已经发布到 Docker Hub：<https://hub.docker.com/r/starspacec/simple-blog-backend>

| 项 | 值 |
| --- | --- |
| 镜像 | `starspacec/simple-blog-backend` |
| 标签 | `latest`、版本号（如 `1.15.0`） |
| 架构 | 目前发布 `linux/amd64`；打 `v*` 标签时 GitHub Actions 也会构建 `linux/arm64` 推 GHCR |
| 基础镜像 | `node:22-alpine`（内置 `node:sqlite`，不需要数据库驱动） |
| 用户 | `1000:1000`（非 root） |
| 端口 | `33001` |
| 健康检查 | 每 30s 请求 `/api/auth/status` |

## 用法

```bash
docker pull starspacec/simple-blog-backend:latest
```

完整启动命令见 [部署后端](../start/backend.md#方式-0用现成镜像)。

## 用 compose 跑镜像（不构建）

仓库里的 `backend/docker-compose.hub.yml`：

```yaml
services:
  backend:
    image: ${IMAGE_NAME:-starspacec/simple-blog-backend}:${IMAGE_TAG:-latest}
    container_name: simple-blog-backend
    restart: unless-stopped
    ports:
      - "127.0.0.1:${HOST_PORT:-33001}:33001"
    env_file: .env
    volumes:
      - ./config.json:/app/config.json
      - ./article:/app/article
      - ./Musings:/app/Musings
      - ./img:/app/img
      - ./file:/app/file
      - ./data:/app/data
```

靠 `.env` 里的 `IMAGE_TAG` 切换版本，升级：

```bash
docker compose -f docker-compose.hub.yml pull
docker compose -f docker-compose.hub.yml up -d
```

## 自己构建

```bash
cd backend
docker compose up -d --build        # 用 docker-compose.yml（带 build: .）
```

或者手动：

```bash
docker build -t my-blog-backend:dev .
```

!!! note "sharp 与架构"
    镜像里用 `npm install` 拉 `sharp` 的对应平台二进制；跨架构构建（如 amd64 机器构建 arm64）需要 QEMU，GitHub Actions 里已经用 `docker/setup-qemu-action` 处理。

## 检查容器

```bash
docker compose ps                                   # Up (healthy)
docker inspect --format '{{.State.Health.Status}}' simple-blog-backend
docker logs --tail 50 -f simple-blog-backend
docker exec -it simple-blog-backend sh              # 进容器
```

## 下一步

[备份与升级 :material-arrow-right:](../ops/backup.md){ .md-button .md-button--primary }
