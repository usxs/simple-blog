# 更新日志

本项目的所有重要变更记录在此文件中，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [1.1.0] - 2026-11-22

### 新增

- **后台「管理」页**：在侧边栏「奇奇怪怪」下方新增独立管理页，集中放置站点信息、管理员账号、两步验证、
  通行密钥与登录会话，原先散在顶栏的「修改密码」入口一并移入。
- **站点信息可视化修改**：站点名称、头像文字、浏览器标题、副标题都可在后台改，
  前端启动时读取 `GET /api/site` 覆盖内置配置，文章页 / 列表页 SSR 也会读取同一接口，改完刷新即生效，
  不需要重新部署前端。
- **两步验证（TOTP）**：标准 RFC 6238（30 秒步长、SHA-1、6 位、±1 窗口），支持扫码或手动输入密钥绑定、
  登录时补输动态码、生成 10 个一次性备用码（只存 SHA-256，命中即作废）；关闭 2FA 需验证当前密码。
- **通行密钥（Passkey / WebAuthn）**：指纹 / 面容 / 安全密钥登录与免密登录入口，
  服务端仅保存公钥与签名计数器，支持多设备注册与逐个删除；校验 challenge、origin、rpIdHash 与计数器回退。
- **管理员账号管理**：改用户名（需当前密码）、改密码（自动吊销其它设备会话）。
- **登录会话列表**：显示 IP、UA、创建与最近活跃时间，可一键下线其它设备。
- **动态 `favicon`**：头像文字变化后浏览器标签图标同步更新。

### 变更

- 后台登录接口 `POST /api/auth/login` 支持可选的 `totpCode` 字段，缺少动态码时返回 `needTotp: true`。
- `docker-compose.yml` 新增 `SITE_NAME` / `SITE_AVATAR` / `SITE_TITLE` / `SITE_SUBTITLE` 与
  `WEBAUTHN_RP_ID` / `WEBAUTHN_ORIGIN` 环境变量（均为可选）。
- `.gitignore` 增加 `*.tar.gz`、`*.tgz`、`.backup-*`，避免把备份包误提交。

### 修复

- 后台「管理」页不再显示内容存储路径提示（如 `./Musings/*.md | ./img/日期/`），该提示只在文章、碎碎念、工具等
  内容类页面出现。
- 受保护接口的跨站写请求原先返回 401，现按语义返回 403「拒绝跨站请求」。
- 后台容器以非 root 运行时，若源码文件权限为 600 会读不到（`EACCES: open '/app/backend/auth.js'`），
  镜像与部署脚本统一 `a+r`。

## [1.0.0] - 2026-11-21

首个公开版本。

### 新增

- **账密登录**：`scrypt` 加盐哈希（N=16384/r=8/p=1）、恒定时间比较、用户名与口令均不泄露时序；
  服务端会话只存 `sha256(token)`，Cookie 带 `HttpOnly` + `SameSite=Strict`（HTTPS 下追加 `Secure`），
  滑动有效期 7 天、绝对上限 30 天；登录失败按 IP 限流（15 分钟 5 次）。
- **CSRF 防护**：非 GET 请求校验 `Origin` / `Sec-Fetch-Site`，跨站写请求直接 403。
- **内容管理**：文章、碎碎念、工具、状态、奇思妙想五个板块，Markdown 落盘，后台带实时预览与日期排序。
- **图片上传**：自动转 WebP（quality 82）、长边压缩到 2560px、转换后更大则保留原图、原图不落盘、
  按 `时间戳-原名.webp` 命名并自动去重。
- **评论系统**：算术验证码 + 蜜罐字段 + 频率限制 + 后台审核 + 楼中楼回复。
- **SEO**：真实路径路由（`/post/<id>`）、Pages Functions 文章页 SSR、动态 `sitemap.xml`、
  `robots.txt`、Open Graph、JSON-LD（WebSite / BlogPosting）、IndexNow 即时推送。
- **移动端适配**：≤860px 单列布局 + 底部悬浮导航，导航高亮随当前页面同步；
  375–430px 窄屏单独压缩导航间距，六个入口一屏放得下。
- **部署**：Dockerfile + docker-compose（非 root 运行、数据卷、healthcheck）、
  `.env.example`、`docs/DEPLOY.md`（含 Nginx 反代、Cloudflare、GSC/Bing 收录）、`docs/API.md`。
- **文档**：README 含功能表、架构图、目录结构、界面预览（桌面 + 手机）、环境变量、注意事项与排障表。

### 修复

- 修复 `/post/<id>` 等多级路径下 `./style.css`、`./app.js`、`./markdown.js` 被解析成
  `/post/style.css` 等错误地址，导致文章页样式丢失、脚本不执行的问题；改为根路径引用。
- 修复窄屏（≤430px）底部导航最后一个入口被裁切、需要横向滚动才能点到的问题。
- 修复文章详情页底部导航高亮停留在上一个板块的问题（详情页归属「文章」）。
- 修复后台页标题与页脚仍显示旧品牌名的问题。

### 安全

- 移除历史遗留的静态 `ADMIN_TOKEN` 与 `change_this_secret_token` 默认值，旧 Bearer Token 方式全部失效。
- 会话与凭据文件以 `0600` 写入并原子替换；数据目录不可写时返回 503 并给出修复指引，不再让进程崩溃。
- 公开接口按白名单放行 CORS，其余接口仅接受同源请求。

