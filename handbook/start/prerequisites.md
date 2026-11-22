# 部署前准备

## 1. 清单

| 项目 | 要求 | 说明 |
| --- | --- | --- |
| 服务器 | 1 核 1G 起，x86_64 或 arm64 | 需要能装 Docker；用来跑后端 |
| 系统 | Debian / Ubuntu（推荐） | 其它发行版把包管理命令换掉即可 |
| 域名 | 一个，比如 `example.com` | 建议 `www.example.com` 做博客、`api.example.com` 做后端 |
| Cloudflare 账号 | 免费版即可 | 托管 DNS + 部署前端（Pages） |
| Docker | 20.10+，compose v2 | `docker compose` 而不是旧的 `docker-compose` |
| 邮箱 / Bark / Telegram | 可选 | 用于通知推送，不配也能正常用 |

!!! tip "想先本地看看效果？"
    后端可以直接 `docker run` 起来，前端用 `python3 -m http.server` 或 `npx serve` 打开，把 `frontend/app.js` 里的 `apiBaseUrl` 改成 `http://127.0.0.1:33001` 即可。

## 2. 域名规划

假设你买的是 `example.com`：

- `www.example.com` → 博客前台（Cloudflare Pages）
- `api.example.com` → 后端 API（你自己的服务器，Nginx 反代）
- `example.com` → 301 跳到 `www.example.com`

这两个子域建议都**开启 Cloudflare 代理（橙色小云朵）**，隐藏源站 IP。

## 3. 安装 Docker

```bash
curl -fsSL https://get.docker.com | sh
docker -v && docker compose version
```

## 4. 了解数据放在哪

备份只需要拷这几个目录（都在后端目录下）：

```
config.json           # 工具 / 状态 / 奇思妙想的配置
article/              # 文章（每篇一个目录：<id>/<id>.md）
Musings/              # 瞬间（.md）
img/、file/           # 上传的图片与附件（按日期分目录）
data/                 # 账号、会话、友链、推送配置、验证码密钥等
```

!!! warning "权限很关键"
    容器以 `UID 1000` 运行。宿主机上的这些目录必须能写，否则首次启动会报「数据目录不可写」：

    ```bash
    mkdir -p data article Musings img file
    touch config.json      # 必须是文件，不能是目录
    sudo chown -R 1000:1000 data article Musings img file config.json
    ```

## 5. 决定用哪种方式部署后端

=== "现成镜像（最快）"

    直接用 Docker Hub 上构建好的镜像，不需要源码：

    ```bash
    docker pull starspacec/simple-blog-backend:latest
    ```

    详见 [部署后端 → 方式 0](backend.md#方式-0用现成镜像)。

=== "从源码构建"

    需要把仓库拉下来，改动代码后重新 `--build`：

    ```bash
    git clone https://github.com/usxs/simple-blog.git
    cd simple-blog/backend
    docker compose up -d --build
    ```

    详见 [部署后端 → 方式 A](backend.md#方式-a从源码构建)。

## 下一步

[部署后端 :material-arrow-right:](backend.md){ .md-button .md-button--primary }
