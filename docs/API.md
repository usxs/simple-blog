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

### `GET /api/site`

站点信息，前台启动时读取，用来覆盖内置配置（后台「管理」页可修改）。

```json
{
  "ok": true,
  "site": {
    "name": "简单博客",
    "avatarText": "简",
    "title": "简单博客",
    "subtitle": "这里是我的个人博客，记录技术、折腾与生活。",
    "modules": {
      "home":    { "enabled": true,  "name": "首页",     "icon": "home",     "route": "" },
      "posts":   { "enabled": true,  "name": "文章",     "icon": "book",     "route": "posts" },
      "moments": { "enabled": true,  "name": "瞬间",   "icon": "message",  "route": "moment" },
      "tools":   { "enabled": true,  "name": "工具",     "icon": "wrench",   "route": "tools" },
      "probe":   { "enabled": true,  "name": "探针",     "icon": "activity", "route": "probe" },
      "status":  { "enabled": true,  "name": "状态",     "icon": "heart",    "route": "status" },
      "quirky":  { "enabled": true,  "name": "奇奇怪怪", "icon": "star",     "route": "quirky" }
    },
    "order": ["home", "posts", "moments", "tools", "probe", "status", "quirky"],
    "probe": {
      "enabled": true,
      "provider": "cf",
      "label": "CF 探针",
      "url": "https://monitor.example.com",
      "panelUrl": "https://monitor.example.com/#/"
    },
    "footer": {
      "copyright": true,
      "icpText": "京ICP备2026000001号-1",
      "policeText": "京公网安备 11010502030146号",
      "moeText": "萌ICP备20231234号",
      "extra": "本站由 简单博客 驱动"
    },
    "socials": {
      "github": "https://github.com/your-name",
      "x": "",
      "telegram": "https://t.me/your-name",
      "email": "mailto:hi@example.com"
    },
    "updatedAt": 0
  }
}
```

`modules` 描述前台每个栏目：`enabled` 为 `false` 时前台导航不显示该栏目，直接访问会得到「栏目已关闭」占位页；`name` 最多 12 字；`icon` 可以是内置图标名（`home/book/message/wrench/activity/heart/star/code/camera/music/globe/folder/link/zap/coffee/image`）、以 `/` 开头的站内图片路径，或 `http(s)` 绝对地址。`home` 固定显示，不可关闭。

`route` 是栏目的前台访问路径（不含前导 `/`）：`posts` 对应 `/posts`，改成 `tech` 后前台地址变为 `/tech`；
旧地址 `/posts` 仍可访问并自动跳转。路径限制 1–24 位，只允许字母、数字与短横线，不能与
`post` / `api` / `admin` / `img` 等保留路径冲突，也不能两个栏目重复——后台会自动校验并回退到默认值。

后台改栏目配置同样走 `POST /api/admin/site`，支持只传某几个栏目做局部合并：

```jsonc
POST /api/admin/site
{ "modules": { "posts": { "enabled": false }, "moments": { "route": "diary" }, "quirky": { "name": "杂记", "icon": "/img/2026-11-22/xxx.webp" } } }
```

`probe` 描述前台「探针」页的数据来源：`enabled` 为 `false` 时前台显示「探针未启用」；
`provider` 只能是 `cf`（CF-Server-Monitor，读 `<url>/api/servers`）或 `minimal`（极简探针 monitor，读 `<url>/api/nodes`），
由后端统一成同一种节点结构；`url` 必须是 `http(s)` 地址，`panelUrl` 为「打开监控后台」按钮的跳转地址（可留空）。
后台改探针配置同样走 `POST /api/admin/site`：

```jsonc
POST /api/admin/site
{ "probe": { "provider": "minimal", "url": "https://monitor.example.com", "panelUrl": "" } }
```

`updatedAt` 为 0 表示还在用环境变量里的初始值。响应头带 `Cache-Control: no-cache`。

`whitelist` 是前台放行外链的域名白名单（数组，元素不带协议，如 `"github.com"`）。默认是内置的几个常见站点；后台「管理 → 安全 → 外链白名单」可以增删，保存走：

```jsonc
POST /api/admin/site
{ "whitelist": ["github.com", "example.org"] }
```

不在白名单里的外链，前台点击时会先弹确认框；列表清空则所有外链都弹确认。

### `POST /api/auth/passkey/login-options` / `POST /api/auth/passkey/login`

通行密钥免密登录（公开接口，仍需同源）。先取 challenge：

```json
{ "username": "admin" }        // 可省略，省略时用 allowCredentials 为空列表的 discoverable 流程
```

返回：

```json
{ "ok": true, "options": { "challenge": "…", "rpId": "api.example.com", "timeout": 60000,
  "userVerification": "preferred", "allowCredentials": [{ "type": "public-key", "id": "…" }] } }
```

登录：

```json
{ "credential": { "id": "…", "rawId": "…", "type": "public-key",
  "response": { "clientDataJSON": "…", "authenticatorData": "…", "signature": "…" } } }
```

成功返回 `200 {"ok":true,"username":"…"}` 并下发会话 Cookie；失败 `401`。

`footer` 是页脚备案信息（三个备案号留空即整枚徽章隐藏，前台只显示图标，悬停看号码、点击跳官方查询页；`copyright=false` 时连版权行一起隐藏）；`socials` 是首页标题下方的社交链接（留空即隐藏该项）。
两者都在后台「管理 → 页脚与备案 / 社交链接」维护，也支持 `POST /api/admin/site` 局部合并：

```jsonc
POST /api/admin/site
{
  "footer": { "copyright": false, "icpText": "京ICP备2026000001号-1", "policeText": "京公网安备 11010502030146号", "moeText": "萌ICP备20231234号" },
  "socials": { "github": "https://github.com/your-name", "email": "hi@example.com" }
}
```

| 字段 | 长度 | 说明 |
| --- | --- | --- |
| `footer.copyright` | — | 布尔值，是否显示 `© 年份 站名 · All Rights Reserved.`，默认 `true` |
| `footer.icpText` | 60 | ICP 备案号，前台徽章链接到 `beian.miit.gov.cn` |
| `footer.policeText` | 60 | 公安网备案号，前台按其中数字生成 `beian.mps.gov.cn` 查询链接 |
| `footer.moeText` | 60 | 萌 ICP 备案号，前台按其中数字生成 `icp.gov.moe` 查询链接 |
| `footer.extra` | 120 | 页脚补充说明（如「本站由 X 驱动」），留空不显示 |
| `socials.github` / `x` / `telegram` | 200 | 只接受 `http(s)` 地址 |
| `socials.email` | 200 | 只接受 `mailto:`；后台输入纯邮箱会自动补 `mailto:` |

### `GET /api/sync?module=<模块>[&version=<哈希>]`

匿名请求 `module=posts` 时只返回摘要（`id/title/date/tag/mtime/excerpt`），并带 `ETag`：
带上 `If-None-Match` 命中时返回 `304` 空体，省掉整包传输。登录后（或显式 `full=1`）返回含 `content` 的完整数据。

`module` 取值：`posts` / `moments` / `tools` / `status` / `quirky` / `comments`。

- 除 `comments` 外均为公开；匿名请求 `posts` 只拿摘要，登录后（带会话 Cookie）才返回含正文 `content` 的全文；
- 摘要条目字段：`id/title/date/tag/tags/hidden/locked/enchint/mtime/excerpt`。`hidden` 表示文章设为「前台隐藏」，匿名请求会被过滤掉，登录后台仍可见；`locked` 为 true 表示整篇加密，此时 `excerpt` 恒为空；
- 传 `version` 可做增量判断，命中时返回 `{"updated": false, ...}`；
- 响应带 `ETag`，可以用 `If-None-Match` 换 304；
- `module=comments` 需要登录，返回含待审核评论的完整列表。

### `GET /api/search?q=<关键词>&limit=<1-50>`

文章搜索。中文按子串匹配，英文支持子序列（打错几个字母也能命中），标题 / 标签 / 正文按权重排序。

- 匿名可访问，`Cache-Control: public, max-age=30`
- 响应头带 `X-Total-Count`（命中总数，不含分页）
- 结果只返回摘要片段，正文请走 `/api/public/post/<id>`

```json
{
  "ok": true,
  "query": "缓存",
  "count": 12,
  "results": [
    { "id": "2026-11-20-post", "title": "…", "date": "2026-11-20", "tag": "…", "score": 6, "snippet": "…命中词前后各 48 字…" }
  ]
}
```

### `GET /api/public/post/<id>`

单篇文章，供 Cloudflare Pages Functions 抓取做 SSR。

```json
{ "ok": true, "post": { "id": "my-post", "title": "…", "date": "2026-01-01", "tags": ["…"], "content": "…", "mtime": 1767… } }
```

- 不存在，或文章是「前台隐藏」且未登录：`404 {"error":"Not Found"}`；
- 整篇加密的文章不返回 `content`，改为 `{"ok":true,"post":{…,"locked":true,"enchint":"口令提示","excerpt":""}}`，并带 `Cache-Control: no-store`，正文要拿口令换（见下）；
- 普通文章响应带 `Cache-Control: public, max-age=60`。

### `POST /api/public/post/<id>/unlock`

整篇文章加密后的口令校验（公开接口，同源）。

```json
{ "password": "口令" }
```

成功：`{"ok":true,"content":"明文正文","id":"my-post"}`；口令错误：`403 {"ok":false,"error":"口令错误"}`；失败次数过多：`429`。

### `POST /api/public/unlock-fragment`

正文片段加密的口令校验（公开接口）。片段在 Markdown 里是 `:::locked <base64>` 标记，把 `<base64>` 原样放进 `payload`：

```json
{ "password": "口令", "payload": "eyJ2IjoxLCJjb3N0IjoxNjM4NCw…" }
```

成功返回 `{"ok":true,"content":"片段明文"}`；口令错误或数据损坏返回 `403`。同一 IP 连续输错会触发频率限制（`429`）。

### `POST /api/admin/post/unlock`

后台编辑加密文章时用：校验口令后返回明文正文，**需要登录**，不受公开接口的 IP 频率限制。

```json
{ "id": "my-post", "password": "口令" }
```

成功 `{"ok":true,"content":"…"}`；口令错误 `403 {"ok":false,"error":"口令错误"}`。

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
{ "username": "admin", "password": "…", "totpCode": "123456" }
```

`totpCode` 可选，但账号启用两步验证后必填（也可填备用码，如 `ABCD-EFGH`）。

- 缺少动态码：`401 {"ok":false,"needTotp":true,"error":"请输入两步验证码"}`
- 动态码错误：`401 {"error":"两步验证码不正确"}`
- 其它失败统一返回 `401 {"error":"用户名或密码错误"}`；触发限流返回 `429`（带重试间隔）。

### `POST /api/auth/logout`

清 Cookie 并吊销当前会话。

### `POST /api/auth/change-password`

```json
{ "currentPassword": "旧密码", "newPassword": "新密码" }
```

成功后旧会话全部失效，并轮换发放新的 Cookie。

### 管理页相关接口

| 接口 | 说明 |
| --- | --- |
| `GET /api/admin/overview` | 汇总数据：`{username, site, totp:{enabled,pending,backupCodesLeft}, passkeys, sessions, dataWritable, version}` |
| `POST /api/admin/site` | 保存站点信息：`{name, avatarText, title, subtitle, modules, whitelist}`，长度上限 40/2/80/200，栏目 `name` 12 字、`route` 24 位；只传部分字段做局部合并 |
| `POST /api/auth/change-username` | `{password, username}`；成功后旧会话失效 |
| `POST /api/auth/totp/setup` | `{password}` → `{secret, otpauth}`，此时还没启用 |
| `POST /api/auth/totp/enable` | `{code}` → `{backupCodes:[10 个明文备用码]}`（只显示这一次） |
| `POST /api/auth/totp/disable` | `{password}` |
| `POST /api/auth/backup-codes` | `{password}` → 重新生成 10 个备用码 |
| `GET /api/auth/passkeys` | `{passkeys:[{id,name,createdAt,lastUsedAt}]}` |
| `POST /api/auth/passkey/register-options` | `{password}` → WebAuthn `PublicKeyCredentialCreationOptions` |
| `POST /api/auth/passkey/register` | `{credential, name}`，注册成功后立即可用 |
| `POST /api/auth/passkey/delete` | `{password, id}` |
| `GET /api/auth/sessions` | `{sessions:[…], history:[…], blocked:[…]}`，每条会话含 `id/short/current/status(online/offline/expired)/label/ip/ua/device{type,os,browser,label}/createdAt/lastSeenAt/endedAt/reason/durationMs` |
| `POST /api/auth/sessions/revoke-others` | 吊销除当前会话外的所有会话 |
| `POST /api/auth/sessions/revoke` | `{id}` — 踢某个设备下线，会话进入历史记录 |
| `POST /api/auth/sessions/rename` | `{id, label, history?}` — 给会话改备注名（24 字以内） |
| `POST /api/auth/sessions/block` | `{id, scope:'ip'\|'device'\|'both', note?}` — 按 IP 或设备指纹加入登录黑名单 |
| `POST /api/auth/blocklist/remove` | `{type:'ip'\|'device', value}` — 解除封禁 |
| `GET /api/auth/sessions/geo?ip=` | `{ok, label, country, region, city, isp}` — IP 归属地（内网地址直接返回本机提示） |
| `GET /api/admin/indexnow` | 读取 IndexNow 配置：`{key, keyLocation, valid, enabled, source:'file'\|'env'\|'none', fileName}` |
| `POST /api/admin/indexnow` | `{key, keyLocation?}` 保存密钥（`key` 为空即关闭推送）；密钥需 8–64 位字母数字或短横线 |
| `POST /api/admin/indexnow/verify` | 抓取 `keyLocation` 校验文件内容；未部署时返回「这个地址返回的是网页…」或「文件内容与密钥不一致」 |
| `GET /api/admin/telegram` | 读取瞬间同步配置：`{enabled, chatId, siteUrl, silent, hasToken, botTokenMasked, updatedAt}`，附带 `synced`（已同步条数） |
| `POST /api/admin/telegram` | `{enabled, botToken?, chatId, siteUrl?, silent?}`，`botToken` 省略表示不修改；`botToken` 只返回掩码 |
| `POST /api/admin/telegram/test` | 校验 Bot 并往频道发一条测试消息：`{ok, botUsername, messageId}`；错误会翻成中文原因 |

IndexNow 配置优先读取 `data/indexnow.json`（后台写入），没有再回落到环境变量 `INDEXNOW_KEY` / `INDEXNOW_KEY_LOCATION`；配置变化后不需要重启，下一次发布 / 删除文章即生效。

瞬间同步：开启后 `POST /api/save`（`module=moments`）写盘成功会在后台异步发送到 Telegram 频道，`POST /api/delete`（`module=moments`）会撤回对应消息。发送失败只写日志、不影响保存结果。配置存 `data/telegram.json`（0600），消息映射存 `data/telegram-map.json`；编辑瞬间采用「先撤回旧消息再发新的」策略，保证图片变化也能同步。

会话状态判定：最近 3 分钟内有请求的记为 `online`，否则 `offline`；被踢下线、主动退出、过期归档的进入 `history`（保留最近 80 条）。黑名单命中后，登录接口返回 403「该设备或 IP 已被禁止登录」。

所有接口都需要有效的会话 Cookie；写操作还要通过同源校验（`Origin` / `Sec-Fetch-Site`）。

### 备份与迁移接口

后台「管理 → 备份」用的一组接口（都需登录）：

| 接口 | 说明 |
| --- | --- |
| `GET /api/admin/backup/status` | `{running, job, history, config:{keep,dir,site,frontendDir,freeBytes}, settings}`；`job` 是当前/最近一次任务快照 |
| `GET /api/admin/backup/history` | `{history:[{file,bytes,createdAt,files,frontendVersion}], config}` |
| `POST /api/admin/backup/start` | 立即备份，返回 `202 {ok, job}`；已有任务在跑时返回 `409` |
| `GET /api/admin/backup/download?file=<包名>` | 下载 `.tar.gz`（`Content-Type: application/gzip`）；文件名必须以 `BACKUP_PREFIX`（默认 `backup-`）开头，防目录穿越 |
| `POST /api/admin/backup/delete` | `{file}` 删除某个备份包 |
| `GET /api/admin/backup/settings` | 读取自动备份/WebDAV 配置（WebDAV 密码只回 `passwordSet: true`） |
| `POST /api/admin/backup/settings` | `{auto, time:"HH:MM", keep, webdav:{enabled,url,username,password?,dir,autoUpload}}`；`password` 省略表示沿用原密码 |
| `POST /api/admin/backup/webdav-test` | 用当前或请求体里的配置探测 WebDAV 目录，返回 `{ok, error?}` |
| `POST /api/admin/backup/webdav-upload` | `{file?}` 把指定/最新备份包上传到 WebDAV |

备份包内容：整份后端源码 + `data/` 数据 + 前端快照（有源码时复制 `../前端`，否则抓线上站点的 HTML/CSS/JS）+ `manifest.json`（记录 `frontend.version`、分支、提交号）+ `restore.sh` + `MIGRATION.md` + `docker-compose.yml` + `.env.example`，可在新服务器上解包后一键恢复（详见 `docs/DEPLOY.md`）。

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

---

## 探针节点

### `GET /api/probe-servers`

前台「探针」页的数据来源，由后端代理上游并在两种探针之间做统一。无需登录。

```json
{
  "ok": true,
  "enabled": true,
  "provider": "cf",
  "label": "CF-Server-Monitor",
  "panelUrl": "https://monitor.example.com/#/",
  "servers": [
    {
      "id": "894f2e5c-…",
      "name": "NetCup 1o",
      "region": "DE",
      "group": "Default",
      "online": true,
      "cpu": 17.3,
      "load": 0,
      "memUsed": 769.3,
      "memTotal": 973,
      "diskUsed": 6174,
      "diskTotal": 30063,
      "netIn": 118360,
      "netOut": 6685,
      "pings": [ { "label": "电信", "ms": 208 }, { "label": "BGP", "ms": 0 } ],
      "lastUpdated": 1795286644000,
      "uptime": 0
    }
  ],
  "stats": { "total": 2, "online": 2, "offline": 0 }
}
```

- 容量单位统一为 MB，速率单位为 B/s；`lastUpdated` 为毫秒时间戳
- `provider=minimal` 时 `pings` 为空数组（极简探针不提供四网延迟）
- 探针关闭时返回 `{"ok":true,"enabled":false,"servers":[]}`；未填地址时返回空列表并带 `error: "未配置探针地址"`
- 上游不可达返回 `502 {"ok":false,"error":"…"}`，错误信息会带到前台

### `GET /api/deploy-version`

后端读取前端站点根域的 `/version`（Cloudflare Pages Function），缓存 60 秒，供后台侧边栏显示前端部署版本。

```json
{ "ok": true, "version": "bd358f4d", "branch": "main", "commit": "", "site": "https://www.example.com" }
```

前端未部署 Functions 或读取失败时返回 `{"ok":false,"error":"暂时无法读取前端版本"}`，HTTP 状态仍为 200。

## 友链（公开）

### `GET /api/links`

返回已通过审核的友链（按更新时间倒序），前台「友链」页使用。

```json
{
  "ok": true,
  "links": [
    {
      "id": "5c5b637bb820",
      "name": "星星的站",
      "url": "https://stars.example.com",
      "icon": "",
      "note": "写代码的",
      "initial": "星",
      "createdAt": 1732266000000
    }
  ]
}
```

- `icon` 为空时用 `initial`（站名首个字符）作为文字图标；前台图片加载失败也会回退到它。
- 响应带 `Cache-Control: public, max-age=60`。

### `POST /api/links/apply`

访客提交友链申请，进入待审核状态。

```json
{ "name": "星星的站", "url": "stars.example.com", "icon": "https://stars.example.com/icon.png", "note": "写代码的", "email": "me@example.com" }
```

- `email` 可选：填了之后审核结果会发一封邮件给申请人（不填就不发，前台也不会显示这个字段的值）。

- `url` 省略协议时自动补 `https://`；只接受 `http(s)`，域名必须带点。
- 同一地址重复提交：已通过 → `这个网站已经在友链里了`；待审核 → `已经提交过申请，正在等待审核`；被驳回可以重新提交。
- 限流：每 IP 每小时最多 5 次、10 分钟内最多 2 次，超限返回 `429` 与 `retryAfter`（秒）。
- 成功：`200 {"ok":true,"item":{…}}`，同时会按配置给站长发 Bark / 邮件通知。

## 友链管理（需登录）

| 接口 | 说明 |
| --- | --- |
| `GET /api/admin/links` | `{ok, items, overview}`，`items` 含待审核 / 已通过 / 已驳回，`overview` 是 `{total, count:{pending,approved,rejected}}` |
| `POST /api/admin/links/approve` | `{id}` → 通过后前台立即可见 |
| `POST /api/admin/links/reject` | `{id, rejectReason}` → 驳回（已通过的会下架）；`rejectReason` 必填，会写进通知邮件 |
| `POST /api/admin/links/create` | `{name,url,icon,note,email}` → 后台直接新增，保存即为「已通过」，前台立即可见 |
| `POST /api/admin/links/update` | `{id, patch:{name,url,icon,note,email}}` → 编辑 |
| `POST /api/admin/links/delete` | `{id}` → 永久删除 |

审核类接口都返回最新的 `{ok, items, overview}`，前端据此整体重绘列表。审核结果会邮件通知申请人（仅当申请时填了邮箱）。

`icon` 除 `http(s)` 地址外，也接受本站上传后的绝对地址（如 `https://api.example.com/img/2026-11-22/xxx.webp`）；后台「新增 / 编辑」里的「上传图片」会走 `POST /api/upload`（`kind:"image"`），图片统一转成 WebP。

## 推送设置（需登录）

| 接口 | 说明 |
| --- | --- |
| `GET /api/admin/notify` | `{ok, config}`，密码只返回 `hasPass` / `passMasked` |
| `POST /api/admin/notify` | 局部合并保存：可只传 `mail`、`bark`、`channels` 或某个 `templates.<id>`；`pass` 留空表示不修改 |
| `POST /api/admin/notify/test` | `{kind:"mail"\|"bark", to?}` → 发送测试通知，失败返回中文原因 |

`config` 结构：

```json
{
  "mail": { "enabled": true, "host": "smtp.example.com", "port": 465, "secure": true, "user": "no-reply@example.com", "from": "no-reply@example.com", "fromName": "简单博客", "hasPass": true, "passMasked": "se****23" },
  "bark": { "enabled": true, "server": "https://api.day.app", "key": "xxxxxxxx", "group": "简单博客", "level": "active", "sound": "" },
  "channels": { "adminMail": true, "adminBark": false },
  "templates": {
    "comment_reply": { "subject": "{{site}} · {{replier}} 回复了你在《{{title}}》下的留言", "text": "…" },
    "comment_received": { "subject": "{{site}} · 新评论：{{name}} 在《{{title}}》留言", "text": "…" },
    "link_received": { "subject": "…", "text": "…" },
    "link_result": { "subject": "…", "text": "…" },
    "security_alert": { "subject": "…", "text": "…" },
    "bark_comment": { "title": "…", "text": "…" },
    "bark_link": { "title": "…", "text": "…" },
    "bark_security": { "title": "…", "text": "…" }
  },
  "templateMeta": {
    "comment_reply": { "audience": "user", "channel": "mail", "label": "评论回复（发给访客）" },
    "link_result": { "audience": "user", "channel": "mail", "label": "友链结果（发给申请人）" },
    "comment_received": { "audience": "admin", "channel": "mail", "label": "新评论（发给站长）" }
  }
}
```

- `channels.adminMail` / `channels.adminBark` 决定**发给站长**的通知走哪些渠道；发给访客的通知（评论回复、友链结果）固定走邮件，不受这两个开关影响。
- `templateMeta` 给出每个模板的受众与渠道，后台据此把模板分成「发给访客 · 邮件 / 发给我 · 邮件 / 发给我 · Bark」三组展示。

模板变量：`{{site}}`、`{{name}}`、`{{replier}}`、`{{title}}`、`{{url}}`、`{{content}}`、`{{time}}`、`{{status}}`、`{{reason}}`、`{{reasonLine}}`；Bark 模板额外支持 `{{link}}`（点开通知会跳到这个地址）。邮件正文会套进黑白极简的 HTML 外壳（白底、细边框卡片、灰阶脚注）。

## 后台入口

`GET /api/site` 返回 `adminPath`；`POST /api/admin/site {"adminPath":"console"}` 修改后：

- `/console` 直接返回管理台页面；
- `/admin`、`/admin.html` 自动 302 到新入口；
- 可选值 2–24 位小写字母 / 数字 / 短横线，`api`、`login`、`post` 等保留字会被拒绝并回退 `admin`；
- 环境变量 `ADMIN_PATH` 只决定首次初始化时的默认值。
