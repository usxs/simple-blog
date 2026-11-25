# 部署后端

后端是一个零依赖的 Node 服务，默认监听容器内的 `33001` 端口，只建议绑定到 `127.0.0.1`，由 Nginx 对外提供 HTTPS。

## 方式 0：用现成镜像

镜像：`ghcr.io/usxs/simple-blog-backend`（GHCR，`linux/amd64` + `linux/arm64`）。三个分支各有稳定标签：

| 标签 | 版本 | 形态 |
| --- | --- | --- |
| `latest` | V1 | 后端（文件存储），前端另发 Pages |
| `v2` | V2 | 后端（SQLite），前端另发 Pages |
| `v3` | V3 | 站点 + 后台同一个容器，不需要 Pages |

V3 最短路径（只挂 `data` / `img` / `file`，不需要 `BACKEND_PUBLIC_URL`）：

```bash
mkdir -p blog && cd blog
mkdir -p data img file && sudo chown -R 1000:1000 data img file

docker run -d --name simple-blog --restart unless-stopped \
  -p 127.0.0.1:33001:33001 \
  -v "$PWD/data:/app/data" -v "$PWD/img:/app/img" -v "$PWD/file:/app/file" \
  -e ADMIN_USERNAME=admin -e ADMIN_PASSWORD='换成你自己的强密码' \
  -e SITE_PUBLIC_URL='https://blog.example.com' \
  ghcr.io/usxs/simple-blog-backend:v3
```

打开 `http://服务器IP:33001/` 是站点，`/admin` 是后台。V2 / V3 的完整说明见 [Docker 镜像](../ref/docker.md) 与 [部署 V3 单体版](monolith.md)。

V1（文件存储）仍需要全部卷，并把镜像标签换成 `latest`：

```bash
mkdir -p blog-backend && cd blog-backend
mkdir -p data article Musings img file && touch config.json
sudo chown -R 1000:1000 data article Musings img file config.json

docker run -d --name simple-blog-backend --restart unless-stopped \
  -p 127.0.0.1:33001:33001 \
  -v "$PWD/config.json:/app/config.json" \
  -v "$PWD/article:/app/article" -v "$PWD/Musings:/app/Musings" \
  -v "$PWD/img:/app/img" -v "$PWD/file:/app/file" -v "$PWD/data:/app/data" \
  -e ADMIN_USERNAME=admin \
  -e ADMIN_PASSWORD='换成你自己的强密码' \
  -e SITE_PUBLIC_URL='https://www.example.com' \
  -e BACKEND_PUBLIC_URL='https://api.example.com' \
  ghcr.io/usxs/simple-blog-backend:latest
```

用 compose 的话，从对应分支取这两个文件，改名 `.env` 后启动（V1 示例；V2 / V3 换 URL 里的分支和 `IMAGE_TAG`）：

```bash
curl -O https://raw.githubusercontent.com/usxs/simple-blog/main/backend/docker-compose.hub.yml
curl -o .env https://raw.githubusercontent.com/usxs/simple-blog/main/backend/.env.example
vim .env
docker compose -f docker-compose.hub.yml up -d
```

升级：改 `.env` 里的 `IMAGE_TAG` 后 `docker compose -f docker-compose.hub.yml pull && docker compose -f docker-compose.hub.yml up -d`，数据在卷里不受影响。固定某次构建时用 CI 生成的短 SHA 标签，或打 tag 后使用 `1.18.0` / `2.0.0` / `3.0.0` 这样的版本号。

## 方式 A：从源码构建

```bash
git clone https://github.com/usxs/simple-blog.git
cd simple-blog/backend
git checkout v3-monolith            # V3 单体版；V2 用 v2-sqlite；V1 留 main
mkdir -p data article Musings img file && touch config.json
sudo chown -R 1000:1000 data article Musings img file config.json
cp .env.example .env
vim .env
docker compose up -d --build
```

!!! note "V2 / V3 的数据卷不一样"
    V2 / V3 默认 `STORE=sqlite`，数据落在 `data/blog.db`（含 `-wal` / `-shm`），`article/`、`Musings/`、`config.json` 只有 `STORE=file` 时才用。V3 还会把 `backend/web/` 一起打进镜像，站点与后台由同一个容器提供。

!!! warning "改了代码一定要 `--build`"
    `docker compose up -d` 不会重建镜像，新代码不会生效；必须加 `--build`。

## 环境变量

最低要改这几项（其余见 [环境变量](../ref/env.md)）：

```ini
ADMIN_USERNAME=admin
ADMIN_PASSWORD=换成你自己的强密码     # 只在首次初始化时使用
SITE_PUBLIC_URL=https://www.example.com    # 站点地址，写进 sitemap / 邮件链接
BACKEND_PUBLIC_URL=https://api.example.com # V1 / V2 的接口地址；V3 同域，留空
```

`ADMIN_PASSWORD` 留空也行，首次打开 `https://api.example.com/<ADMIN_PATH>` 会出现初始化页面，填一次即可。

## 验证

```bash
curl -s http://127.0.0.1:33001/api/auth/status
# {"ok":true,"authed":false,"setupNeeded":false,"dataWritable":true}

curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:33001/sitemap.xml   # 200
docker compose ps          # STATUS: Up (healthy)
docker logs --tail 30 simple-blog-backend
```

`dataWritable` 为 `false` 说明目录权限不对，按前面的 `chown` 修；日志里若出现 `EACCES`，同样是权限问题。

## 后台入口

V1 / V2 默认是 `https://api.example.com/admin`，V3 默认是 `https://blog.example.com/admin`。可以在后台「管理 → 站点信息 → 后台入口」改成任意 2–24 位小写字母/数字/短横线（如 `console`），改完旧地址直接返回 401，不暴露新入口。

!!! tip "忘记入口了怎么办"
    改宿主机 `data/site.json` 里的 `adminPath`（或删掉该字段回退默认 `admin`），然后重启容器。

## 下一步

[部署前端 :material-arrow-right:](frontend.md){ .md-button .md-button--primary }
