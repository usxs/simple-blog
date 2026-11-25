# 版本选择

同一份代码按分支发布三种形态。它们的内容模型、接口、后台界面完全一致，区别只有两处：**页面由谁渲染**、**数据存在哪**。所以「选版本」不会限制以后的功能，选错了也能迁。

## 一、对照表

| | **V1** | **V2** | **V3** |
| --- | --- | --- | --- |
| 分支 | `v1` | `v2-sqlite` | `v3-monolith` |
| Docker 标签 | `latest` | `v2` | `v3` |
| 部署形态 | 两段式 | 两段式 | 单体（一个进程） |
| 前端位置 | `frontend/`（Cloudflare Pages） | `frontend/`（Cloudflare Pages） | `backend/web/` |
| SSR | Pages Functions 在边缘渲染 | Pages Functions 在边缘渲染 | Node 进程内渲染 |
| 存储 | Markdown + JSON 文件 | SQLite（`data/blog.db`） | SQLite（`data/blog.db`） |
| 数据库依赖 | 无 | Node ≥ 22.5 内置 `node:sqlite` | 同 V2 |
| 需要 Cloudflare 账号 | 是 | 是 | 否 |
| 需要的域名 | 两个（站点 + 接口） | 两个 | 一个（同域） |
| 后台入口 | `https://api.example.com/admin` | 同 V1 | `https://www.example.com/admin` |
| 数据搬家方式 | 拷目录 / 便携包 | 便携包 / 拷 `blog.db` | 同 V2 |
| 版本号 | `1.x` | `2.x` | `3.x` |

三个分支各自构建镜像：`v1` 发 `latest`，`v2-sqlite` 发 `v2`，`v3-monolith` 发 `v3`；版本号标签对应 `1.x` / `2.x` / `3.x`。V3 镜像一个容器就包含站点与后台，可以直接 `docker run`，详见 [Docker 镜像](../ref/docker.md)。

## 二、怎么选

- **想要「数据就是文件」**：`article/<id>/<id>.md` 用任何编辑器都能改，`git` 也能纳入版本管理 → **V1**。
- **文章上千、评论每天几十上百，或想要事务与查询**：文件写入与全量扫描会越来越吃力 → **V2**。
- **不想注册 Cloudflare，也不想要两段式**：一台 VPS、一个域名、一个容器，`docker run ...:v3` 就能上线 → **V3**。
- **已经有 Cloudflare Pages 站点，只想换后端**：**V2**，前端不用动。
- **想要最少的运维面（一个容器、一个域名、一份数据）**：**V3**。

三者的后台、写作体验、评论、友链、通知都一样；V3 只是把「Pages 那一段」收回到了进程里。

## 三、版本之间怎么迁

### V1 → V2 / V3

V1 后台 **设置 → 迁移** 提供两条路：

1. **一键迁移**：选 V2 或 V3，下载便携包 `.zip`，或直接填目标站点地址 + 迁移令牌推送过去。
2. **命令行**：把 V1 的 `backend/` 目录拷到 V2 / V3 机器上，跑

```bash
node scripts/migrate-v1-to-v2.js --v1-dir /path/to/v1/backend --dry-run   # 先看统计
node scripts/migrate-v1-to-v2.js --v1-dir /path/to/v1/backend
```

两篇文章、评论、瞬间、栏目配置、友链、图片、管理员凭据都会带过去；`--no-uploads` / `--no-auth` 可以跳过对应部分。

### V2 ↔ V3

数据库结构完全一致，`data/blog.db` 直接换机器就能用。区别只在部署文件：V3 多了 `backend/web/`，少一个 Pages 项目。

### V2 / V3 → V1

反向不提供自动迁移（V1 没有数据库，评论与配置的对应关系需要人工确认）。要回到文件存储：

1. 在 V2 / V3 后台导出一份便携包；
2. 或保留 `STORE=file` 的旧数据目录——V2 / V3 都还能以 `STORE=file` 启动，只是不推荐长期这么用。

### 和静态博客互导

三种形态都支持把文章导出成 **Hugo / Hexo / Jekyll / Astro / Ghost / Obsidian / 通用 Markdown**，也能从这些站点导入。详见 [迁移与导入导出](../guide/transfer.md)。

## 四、同一台机器上并存

三个分支的代码目录可以放在同一台机器上，但不要共用 `data/`：V1 的文件存储与 V2 / V3 的数据库不是同一份数据。要并行跑，给每个实例单独的准备目录与端口：

```bash
# V1（文件存储）
STORE=file PORT=33001 node backend/server.js

# V3（SQLite，默认）
PORT=33002 DB_FILE=/srv/blog-v3/data/blog.db node backend/server.js
```

## 下一步

- 第一次部署：[部署前准备](prerequisites.md)
- V3 专项：[部署 V3 单体版](monolith.md)
- 迁移细节：[迁移与导入导出](../guide/transfer.md)
