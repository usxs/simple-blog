# 数据与目录

没有数据库，所有状态都是文件。备份 = 打包目录，迁移 = 拷目录。

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

## 权限

- 容器以 UID 1000 运行，宿主机目录必须 `chown 1000:1000`。
- `data/` 下写入的文件权限为 `0600`；上传的图片/附件对外可读。

## 文件名清洗

id 由标题生成：去掉 `/ \ : * ? " < > |`、换行与首尾空白，空白转 `-`；中文保留。空标题会生成 `post-<时间戳>`。

## 下一步

[Docker 镜像 :material-arrow-right:](docker.md){ .md-button .md-button--primary }
