# 部署前准备

## 1. 清单

| 项目 | 要求 | 说明 |
| --- | --- | --- |
| 服务器 | 1 核 1G 起，x86_64 或 arm64 | 需要能装 Docker；用来跑后端 |
| 系统 | Debian / Ubuntu（推荐） | 其它发行版把包管理命令换掉即可 |
| 域名 | 一个，比如 `example.com` | V1 / V2 建议 `www.example.com` 做博客、`api.example.com` 做后端；V3 一个域名就够（站点与后台同域） |
| Cloudflare 账号 | 免费版即可 | **只有 V1 / V2 需要**：托管 DNS + 部署前端（Pages）。V3 跳过 |
| Docker | 20.10+，compose v2 | `docker compose` 而不是旧的 `docker-compose` |
| 邮箱 / Bark / Telegram | 可选 | 用于通知推送，不配也能正常用 |

!!! tip "先确认要做哪个版本"
    三个分支的部署差别只在「前端在哪」和「数据存哪」，功能一致、数据可互迁。先看一眼 [版本选择](versions.md) 再动手，能省掉后面换形态的功夫。

!!! tip "想先本地看看效果？"
    - **V1 / V2**：后端 `docker run` 起来，前端用 `python3 -m http.server` 或 `npx serve` 打开 `frontend/`，把 `frontend/app.js` 里的 `apiBaseUrl` 改成 `http://127.0.0.1:33001`。
    - **V3**：直接 `PORT=33001 node server.js`（在 `backend/` 下），浏览器打开 `http://127.0.0.1:33001` 就是带 SSR 的完整站点，后台在 `/admin`。

## 2. 域名规划

假设你买的是 `example.com`：

- `www.example.com` → 博客前台（V1 / V2 是 Cloudflare Pages；V3 就是后端服务本身）
- `api.example.com` → 后端 API（V1 / V2 需要；V3 不需要，接口与页面同域）
- `example.com` → 301 跳到 `www.example.com`

V1 / V2 这两个子域建议都**开启 Cloudflare 代理（橙色小云朵）**，隐藏源站 IP；V3 只反代一个域名即可。

## 3. 安装 Docker

```bash
curl -fsSL https://get.docker.com | sh
docker -v && docker compose version
```

## 4. 了解数据放在哪

**V1（文件存储）**，都在后端目录下：

```
config.json           # 工具 / 状态 / 奇思妙想的配置
article/              # 文章（每篇一个目录：<id>/<id>.md）
Musings/              # 瞬间（.md）
img/、file/           # 上传的图片与附件（按日期分目录）
data/                 # 账号、会话、友链、推送配置、验证码密钥等
```

**V2 / V3（SQLite）**：

```
data/blog.db          # 全部内容：文章、瞬间、评论、栏目配置、友链、通知…
data/blog.db-wal      # WAL 伴随文件，备份时一起带上（或用 sqlite3 .backup）
img/、file/           # 图片与附件仍是文件，按日期分目录
```

!!! note "两种存储可以切换"
    V2 / V3 用 `STORE=sqlite`（默认）或 `STORE=file` 选择实现；V1 只有文件存储。切换前先导出便携包，详见 [迁移与导入导出](../guide/transfer.md)。

!!! warning "权限很关键"
    容器以 `UID 1000` 运行。宿主机上的这些目录必须能写，否则首次启动会报「数据目录不可写」：

    ```bash
    mkdir -p data article Musings img file
    touch config.json      # 必须是文件，不能是目录
    sudo chown -R 1000:1000 data article Musings img file config.json
    # V2 / V3 只需要 data img file（blog.db 会建在 data/ 里）
    ```

## 5. 决定用哪种方式部署后端

=== "现成镜像（最快）"

    直接用 GHCR 上构建好的公开镜像，不需要源码。标签按版本分：

    | 版本 | 拉取 |
    | --- | --- |
    | V1（两段式，文件存储） | `docker pull ghcr.io/usxs/simple-blog-backend:latest` |
    | V2（两段式，SQLite） | `docker pull ghcr.io/usxs/simple-blog-backend:v2` |
    | V3（单体，站点 + 后台） | `docker pull ghcr.io/usxs/simple-blog-backend:v3` |

    详见 [部署后端 → 方式 0](backend.md#方式-0用现成镜像) 与 [Docker 镜像](../ref/docker.md)。

=== "从源码构建"

    需要把仓库拉下来，改动代码后重新 `--build`：

    ```bash
    git clone https://github.com/usxs/simple-blog.git
    cd simple-blog/backend
    docker compose up -d --build
    ```

    V2 / V3 记得先切分支：`git checkout v2-sqlite` 或 `git checkout v3-monolith`。

    详见 [部署后端 → 方式 A](backend.md#方式-a从源码构建)。

## 下一步

[部署后端 :material-arrow-right:](backend.md){ .md-button .md-button--primary }
