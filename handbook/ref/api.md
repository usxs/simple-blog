# 接口速查

后端是纯 Node `http` 服务，所有响应都是 JSON（除 `/sitemap.xml`、`/robots.txt`、静态资源）。未登录访问受保护接口返回 `401 {"ok":false,"error":"Unauthorized"}`；跨站写请求返回 `403 {"ok":false,"error":"拒绝跨站请求"}`。

## 公开

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/auth/status` | `{ok, authed, setupNeeded, dataWritable, username?}` |
| GET | `/api/site` | 站点配置（名称、栏目、页脚、社交链接、探针） |
| GET | `/api/sync?module=posts\|moments\|comments` | 列表；匿名返回摘要 + `ETag`，登录或 `full=1` 返回全文 |
| GET | `/api/public/post/<id>` | 单篇文章（含正文） |
| GET | `/api/search?q=&limit=` | 标题/标签/正文模糊搜索 |
| GET | `/api/comments?postId=` | 某篇文章的已通过评论 |
| GET | `/api/captcha` | 新验证码（题目 + 签名） |
| POST | `/api/comments/submit` | 提交评论 |
| GET | `/api/links` | 已通过的友链 |
| POST | `/api/links/apply` | 申请友链 |
| GET | `/api/probe-servers` | 探针节点（按后台配置的数据源） |
| GET | `/api/deploy-version` | 前端部署版本（转发 `/version`） |
| GET | `/sitemap.xml` | 动态站点地图 |
| GET | `/robots.txt` | 后端 robots |

## 登录相关

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/auth/setup` | 首次初始化 `{username,password}` |
| POST | `/api/auth/login` | `{username,password,totpCode?}`，失败可能带 `needTotp` |
| POST | `/api/auth/logout` | 退出并清 Cookie |
| POST | `/api/auth/change-password` | `{currentPassword,newPassword}` |
| POST | `/api/auth/change-username` | `{password,username}` |
| POST | `/api/auth/totp/setup` | 生成密钥与 otpauth 链接 |
| POST | `/api/auth/totp/enable` | `{code}` 启用，返回备用码 |
| POST | `/api/auth/totp/disable` | `{password}` |
| POST | `/api/auth/backup-codes` | 重新生成备用码 |
| GET | `/api/auth/passkeys` | 通行密钥列表 |
| POST | `/api/auth/passkey/register-options` | 注册参数 |
| POST | `/api/auth/passkey/register` | 提交注册响应 |
| POST | `/api/auth/passkey/delete` | `{password,id}` |
| POST | `/api/auth/passkey/login-options` | 登录参数 |
| POST | `/api/auth/passkey/login` | 提交断言 |
| GET | `/api/auth/sessions` | `{sessions, history, blocked}` |
| POST | `/api/auth/sessions/revoke` | `{id}` 踢下线 |
| POST | `/api/auth/sessions/rename` | `{id,label}` |
| POST | `/api/auth/sessions/block` | `{id,scope:ip\|device\|both}` |
| POST | `/api/auth/blocklist/remove` | `{type,value}` |
| GET | `/api/auth/sessions/geo?ip=` | IP 归属地 |

## 内容与站点（需登录）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/save` | `{module,item}` 保存文章/瞬间/工具/状态/奇奇怪怪 |
| POST | `/api/delete` | `{module,id}` 删除 |
| POST | `/api/upload` | `{kind:'image'\|'file',filename,data(base64)}`，图片自动转 WebP |
| POST | `/api/probe-now` | 立刻执行一次状态探测 |
| GET/POST | `/api/admin/site` | 读/改站点配置（支持局部合并） |
| GET | `/api/admin/overview` | 后台初始化数据（站点、会话、友链计数等） |
| GET/POST | `/api/admin/links` `…/{update,approve,reject,delete,create}` | 友链管理 |
| GET/POST | `/api/admin/notify` | 通知配置与模板 |
| POST | `/api/admin/notify/test` | `{kind:'mail'\|'bark', to?}` 测试 |
| GET/POST | `/api/admin/indexnow` | IndexNow 密钥 |
| POST | `/api/admin/indexnow/verify` | 校验密钥文件 |
| GET/POST | `/api/admin/telegram` | 瞬间同步配置 |
| POST | `/api/admin/telegram/test` | 发一条测试消息 |

## 迁移与导入导出（需登录）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/admin/transfer/info` | 统计、可用的导入来源 / 导出目标、体积上限 |
| POST | `/api/admin/transfer/migrate` | `{target:'v2'\|'v3',includeAuth?,includeUploads?}` → `application/zip` 便携包 |
| POST | `/api/admin/transfer/push` | `{url,token,mode:'replace'\|'merge',…}` 服务端推送到目标站点 `/api/migrate/import` |
| POST | `/api/admin/transfer/import-md` | 请求体是 ZIP / `.md` 二进制，query `source` / `name` / `dryRun` |
| POST | `/api/admin/transfer/export-md` | `{target,ids?}` → `application/zip` 静态博客目录结构 |

### 接收端（V2 / V3）

| 方法 | 路径 | 鉴权 | 说明 |
| --- | --- | --- | --- |
| POST | `/api/migrate/import?mode=replace\|merge` | `X-Migrate-Token` 或登录态 | 请求体是 V1 导出的便携包 zip，返回导入统计 |
| GET | `/api/admin/migrate/token` | 登录态 | 查看当前迁移令牌 |
| POST | `/api/admin/migrate/token` | 登录态 | 重置令牌（旧令牌立即失效） |

```bash
# 用令牌导入（不需要 Cookie）
curl -X POST --data-binary @simple-blog-portable-20261125.zip \
  -H "X-Migrate-Token: <后台看到的令牌>" \
  "https://v2.example.com/api/migrate/import?mode=replace"
```

`mode=replace` 会先清空目标站的文章 / 瞬间 / 列表型模块再导入；`mode=merge`（默认）按 id 覆盖，
目标站独有的内容原样保留。返回体里的 `stats` 与 `warnings` 会说明每类数据的条数以及被跳过的项。

## 约定

- 写操作需要 `Content-Type: application/json`（否则 415），以及同源 `Origin`。
- 登录态靠 `console_session` Cookie（`HttpOnly`、`SameSite=Strict`）。
- 列表类接口支持 `ETag` / `If-None-Match`，命中返回 `304` 空体。
- 限流命中返回 `429` 并带 `Retry-After`。

完整字段说明见仓库里的 [`docs/API.md`](https://github.com/usxs/simple-blog/blob/main/docs/API.md)。

## 下一步

[数据与目录 :material-arrow-right:](data.md){ .md-button .md-button--primary }
