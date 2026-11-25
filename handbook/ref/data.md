# 数据与目录

V1 没有数据库，所有状态都是文件（备份 = 打包目录，迁移 = 拷目录）。
V2 / V3 把这些内容搬进 SQLite，图片与附件仍然是文件，目录结构完全兼容 V1。

!!! info "两种存储共用一套代码"
    `STORE=sqlite`（默认）走数据库，`STORE=file` 走 V1 的 Markdown 文件。
    两种模式的读写接口一致，页面看到的东西也一样。

## 目录结构

```
backend/
├── config.json          # 工具 / 状态 / 奇奇怪怪的配置
├── article/
│   └── <id>/
│       ├── <id>.md          # 文章（front-matter + Markdown）
│       └── comments.json    # 该文的评论（有评论才有）
├── Musings/             # 瞬间：<id>.md
├── img/<日期>/          # 上传的图片（WebP）
├── file/<日期>/         # 上传的附件
└── data/
    ├── auth.json        # 账号、scrypt 哈希、TOTP、Passkey
    ├── sessions.json    # 会话、历史、黑名单
    ├── site.json        # 站点配置（站名、栏目、页脚、探针、后台入口）
    ├── links.json       # 友链
    ├── notify.json      # 邮件 / Bark 配置与模板
    ├── indexnow.json    # IndexNow 密钥
    ├── telegram.json    # 机器人配置
    ├── telegram-map.json# 瞬间 ↔ Telegram 消息映射
    └── captcha-secret.json
```

## 文件格式

**文章**（`article/<id>/<id>.md`）：

```markdown
---
title: 用 Nginx 反代 Node 服务
date: 2026-11-20
tag: 部署
---

正文从这里开始……
```

**瞬间**（`Musings/<id>.md`）：

```markdown
---
date: 2026-11-21
tag: 日常
---

今天把评论系统重写了一遍。
```

**评论**（`comments.json`）：

```json
{
  "comments": [
    {
      "id": "c-1",
      "author": "小林",
      "content": "写得很清楚，收藏了",
      "ip": "203.0.113.7",
      "date": "2026-11-21 10:12",
      "status": "approved",
      "replyContent": "谢谢！",
      "replyDate": "2026-11-21 12:03"
    }
  ]
}
```

## 数据库结构（V2 / V3）

数据库是一个文件：`data/blog.db`（WAL 模式，同目录还会有 `blog.db-wal`、`blog.db-shm`，
备份时三个一起带上，或者先停容器再拷）。

| 表 | 主键 | 内容 |
| --- | --- | --- |
| `posts` | `id` | 文章：title / date / tag / tags(JSON) / hidden / enc 系列 / mtime / content |
| `moments` | `id` | 瞬间，字段与文章一致（没有加密字段的实际使用） |
| `comments` | `seq` 自增 | 每条评论一行：`post_id` + `id` + `data`(JSON)，`UNIQUE(post_id, id)` |
| `module_items` | `(module, id)` | 工具 / 状态 / 奇奇怪怪等列表型模块，一条一项，`ord` 控制顺序 |
| `kv` | `key` | 站点配置、友链、通知、IndexNow、Telegram、备份设置、管理员凭据、迁移令牌 |
| `meta` | `key` | 结构版本（`schema_version=2`）等内部状态 |

文章正文在库里存**原始 Markdown**，不是渲染后的 HTML —— 导出、迁移、换版本都不会丢格式。
图片/附件仍在 `img/`、`file/`，数据库只记正文里的 `/img/...` 链接。

常用查询：

```bash
# 看有多少篇文章、多少条评论
sqlite3 data/blog.db "select count(*) from posts; select count(*) from comments;"

# 导出全部文章标题与日期
sqlite3 data/blog.db "select date, title from posts order by date desc;"
```

## 权限

- 容器以 UID 1000 运行，宿主机目录必须 `chown 1000:1000`。
- `data/` 下写入的文件权限为 `0600`；上传的图片/附件对外可读。

## 文件名清洗

id 由标题生成：去掉 `/ \ : * ? " < > |`、换行与首尾空白，空白转 `-`；中文保留。空标题会生成 `post-<时间戳>`。

## 下一步

[Docker 镜像 :material-arrow-right:](docker.md){ .md-button .md-button--primary }
