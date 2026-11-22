# 部署后端

后端是一个零依赖的 Node 服务，默认监听容器内的 `33001` 端口，只建议绑定到 `127.0.0.1`，由 Nginx 对外提供 HTTPS。

## 方式 0：用现成镜像

镜像：`starspacec/simple-blog-backend`（Docker Hub，`linux/amd64`，标签有 `latest` 和版本号）。

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
  starspacec/simple-blog-backend:latest
```

用 compose 的话，把仓库里这两个文件拷到目录，改名 `.env` 后启动：

```bash
curl -O https://raw.githubusercontent.com/usxs/simple-blog/main/backend/docker-compose.hub.yml
curl -o .env https://raw.githubusercontent.com/usxs/simple-blog/main/backend/.env.example
vim .env
docker compose -f docker-compose.hub.yml up -d
```

升级：改 `.env` 里的 `IMAGE_TAG` 后 `docker compose -f docker-compose.hub.yml pull && docker compose -f docker-compose.hub.yml up -d`，数据在卷里不受影响。

## 方式 A：从源码构建

```bash
git clone https://github.com/usxs/simple-blog.git
cd simple-blog/backend
mkdir -p data article Musings img file && touch config.json
sudo chown -R 1000:1000 data article Musings img file config.json
cp .env.example .env
vim .env
docker compose up -d --build
```

!!! warning "改了代码一定要 `--build`"
    `docker compose up -d` 不会重建镜像，新代码不会生效；必须加 `--build`。

## 环境变量

最低要改这四项（其余见 [环境变量](../ref/env.md)）：

```ini
ADMIN_USERNAME=admin
ADMIN_PASSWORD=换成你自己的强密码     # 只在首次初始化时使用
SITE_PUBLIC_URL=https://www.example.com    # 前端地址，写进 sitemap / 邮件链接
BACKEND_PUBLIC_URL=https://api.example.com # 后端地址，写进 robots.txt
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

默认是 `https://api.example.com/admin`。可以在后台「管理 → 站点信息 → 后台入口」改成任意 2–24 位小写字母/数字/短横线（如 `console`），改完旧地址直接返回 401，不暴露新入口。

!!! tip "忘记入口了怎么办"
    改宿主机 `data/site.json` 里的 `adminPath`（或删掉该字段回退默认 `admin`），然后重启容器。

## 下一步

[部署前端 :material-arrow-right:](frontend.md){ .md-button .md-button--primary }
