# 更新日志

本项目的所有重要变更记录在此文件中，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

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

