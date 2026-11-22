# 简单博客

一套可以**自己部署**的极简个人博客系统：静态前端托管在 Cloudflare Pages，后端是一台自己的服务器上跑的 Node 服务，数据全部以 Markdown / JSON 落在磁盘上，**不需要数据库**。

[快速开始](start/prerequisites.md){ .md-button .md-button--primary }
[GitHub 仓库](https://github.com/usxs/simple-blog){ .md-button }
[Docker 镜像](https://hub.docker.com/r/starspacec/simple-blog-backend){ .md-button }

## 它能做什么

| 能力 | 说明 |
| --- | --- |
| 文章 / 瞬间 | Markdown 写作，支持代码高亮、流程图（Mermaid）、图片灯箱 |
| 评论 | 访客免登录评论，算术验证码防刷，站长后台审核与回复 |
| 友链 | 访客自助申请，后台审核、驳回（带原因）、管理员手动添加 |
| 通知 | 新评论、友链申请、登录爆破等事件 → 邮件 / Bark 推送 |
| 账号安全 | 账密登录、两步验证（TOTP）、通行密钥（Passkey）、登录会话管理 |
| 上传 | 图片自动转 WebP 并压缩，附件独立目录 |
| SEO | 服务端渲染（Pages Functions）、动态 sitemap、IndexNow 推送 |
| 站点配置 | 后台改站名、头像、标题、副标题、栏目开关/改名/图标/路径、页脚备案、社交链接 |
| 移动端 | 单列布局 + 液态玻璃底部导航，滚动自动隐藏 |
| 深浅主题 | 黑白两套，可跟随系统 |

## 架构

```
访客浏览器
   │  HTTPS
   ▼
Cloudflare Pages（前端静态资源 + Pages Functions）
   │  /post/<id>、/posts 等路径由 Functions 在边缘注入 SSR 内容
   │  /api/* 跨域直连后端
   ▼
你的服务器：Nginx → Docker 容器（Node 20 + sharp）
   │
   └── data/ article/ img/ file/ … 全部是宿主机文件
```

前端是纯静态资源，后端挂掉时页面照常打开（只是文章正文、评论、探针等接口会失败）；站点配置会在前端本地缓存，后端恢复后自动更新。

## 你需要准备

- 一个域名（托管在 Cloudflare 最省事）
- 一台能跑 Docker 的服务器（1 核 1G 足够）
- 一个 Cloudflare 账号（免费额度够用）
- 可选的 SMTP / Bark / Telegram，用于通知

详见 [部署前准备](start/prerequisites.md)。

## 文档导航

- **第一次部署**：[准备](start/prerequisites.md) → [后端](start/backend.md) → [前端](start/frontend.md) → [域名与 HTTPS](start/https.md) → [SEO](start/seo.md)
- **日常使用**：[后台](guide/admin.md) → [写文章](guide/content.md) → [评论](guide/comments.md) → [友链](guide/links.md) → [通知](guide/notify.md)
- **查参数**：[环境变量](ref/env.md) → [接口](ref/api.md) → [数据目录](ref/data.md)
- **出问题了**：[常见问题](ops/faq.md) → [排错手册](ops/troubleshooting.md)

!!! note "脱敏说明"
    本文档出现的域名一律为 `example.com`，镜像与仓库地址指向公开项目本身；不包含任何服务器地址、密钥或个人数据。
