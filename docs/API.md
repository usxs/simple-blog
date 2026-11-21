# 接口速查

默认地址：`http://127.0.0.1:33001`（生产环境为你的 `api.example.com`）。
所有接口返回 JSON，`Content-Type: application/json; charset=utf-8`。
需要登录的接口依赖 Cookie `console_session`（浏览器自动携带；用 curl 时加 `-b/-c`）。

## 公开接口

### `GET /api/auth/status`

```json
{ "ok": true, "authed": false, "setupNeeded": false, "dataWritable": true }
```

- `setupNeeded`：还没有任何管理员凭据时为 `true`，此时后台会显示初始化向导；
- `dataWritable`：`data/` 目录不可写时为 `false`（通常是宿主机目录权限问题）。

### `GET /api/sync?module=<模块>[&version=<哈希>]`

`module` 取值：`posts` / `moments` / `tools` / `status` / `quirky` / `comments`。

- 除 `comments` 外均为公开，`posts` 的条目包含正文 `content`（前端列表与 SSR 都会用到）；
- 传 `version` 可做增量判断，命中时返回 `{"updated": false, ...}`；
- `module=comments` 需要登录，返回含待审核评论的完整列表。

### `GET /api/public/post/<id>`

单篇文章，供 Cloudflare Pages Functions 抓取做 SSR。

```json
{ "ok": true, "post": { "id": "my-post", "title": "…", "date": "2026-01-01", "content": "…", "mtime": 1767… } }
```

不存在返回 `404 {"error":"Not Found"}`。响应带 `Cache-Control: public, max-age=60`。

### `GET /api/comments?postId=<id>`

返回该文章下**已审核**的评论数组，字段含 `id / author / contact / content / date / parentId / parentAuthor / replyAuthor / replyContent / replyDate`。

### `GET /api/captcha`

```json
{ "question": "3 + 5 = ?", "token": "eyJ…" }
```

提交评论时把 `token` 原样回传为 `captchaToken`。

### `POST /api/comments/submit`

```json
{
  "postId": "my-post",
  "author": "访客",
  "contact": "mail@example.com",
  "content": "写得不错",
  "captchaToken": "eyJ…",
  "captchaAnswer": "8",
  "parentId": "",
  "website_hp": ""
}
```

- `website_hp` 是隐藏蜜罐字段，**必须留空**（填了会被当作机器人静默丢弃）；
- 同一 IP 限制：60 秒内只能提交一次、每小时最多 10 条、验证码错 5 次锁 15 分钟；
- 新评论状态为 `pending`，需要在后台审核后才会出现在 `/api/comments`。

### `GET /sitemap.xml` / `GET /robots.txt`

动态生成，随文章发布/删除即时变化。`sitemap.xml` 里是真实路径（`/post/<id>`），不是 `#/` 锚点。

## 需要登录的接口

### `POST /api/auth/setup`

仅在 `setupNeeded: true` 时可用，之后返回 409。

```json
{ "username": "admin", "password": "至少8位" }
```

成功会直接写入会话 Cookie。

### `POST /api/auth/login`

```json
{ "username": "admin", "password": "…" }
```

失败统一返回 `401 {"error":"用户名或密码错误"}`；触发限流返回 `429`（带重试间隔）。

### `POST /api/auth/logout`

清 Cookie 并吊销当前会话。

### `POST /api/auth/change-password`

```json
{ "currentPassword": "旧密码", "newPassword": "新密码" }
```

成功后旧会话全部失效，并轮换发放新的 Cookie。

### `POST /api/save`

统一的「新增 / 更新」接口，请求体 `{ "module": "...", "item": { ... } }`。

| module | 必填字段 |
| --- | --- |
| `posts` | `title`、`content`；`id` 缺省时由标题或时间戳生成 |
| `moments` / `tools` / `status` / `quirky` | 各自内容字段，`id` 缺省自动生成 |
| `comments` | `postId`、评论 `id`，用于审核（`status: approved`）与作者回复（`replyAuthor/replyContent/replyDate`） |

发布 `posts` 时会写入 `article/<id>/<id>.md`，并在配置了 IndexNow 时推送收录。

### `POST /api/delete`

```json
{ "module": "posts", "id": "my-post" }
```

删除文章会连同该文章目录（含评论）一起移除；删除 `posts` 同样会触发 IndexNow 通知。

### `POST /api/upload`

```json
{ "kind": "image", "filename": "photo.png", "data": "<base64，不含 data: 前缀>" }
```

- `kind=image`：`.jpg/.jpeg/.png/.gif` 自动转 WebP 并压缩到 2560px 以内，原图不落盘；`.svg/.avif` 原样保存；已是 `.webp` 的不再重编码；
- `kind=file`：附件，原样保存到 `file/<日期>/`；
- 命名规则：`<毫秒时间戳>-<原文件名>.<ext>`，同一天重名自动追加 `-1`、`-2`；
- 响应：

```json
{
  "ok": true,
  "converted": true,
  "filename": "1767000000000-photo.webp",
  "url": "https://api.example.com/img/2026-01-01/1767000000000-photo.webp",
  "relativeUrl": "/img/2026-01-01/1767000000000-photo.webp",
  "markdown": "![photo](https://api.example.com/img/2026-01-01/1767000000000-photo.webp)"
}
```

后台会把 `markdown` 直接插入正文光标处。

## 静态资源

```
GET /img/<日期>/<文件名>    # 图片（长缓存）
GET /file/<日期>/<文件名>   # 附件
GET /                       # 管理后台（admin.html）
```
