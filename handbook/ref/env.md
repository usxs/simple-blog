# 环境变量

后端全部配置都走环境变量，写在 `.env`（`docker-compose.yml` 同目录）或 `docker run -e`。

## 必填

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `ADMIN_USERNAME` | `admin` | 首次初始化的管理员用户名 |
| `ADMIN_PASSWORD` | 空 | 首次初始化的密码（≥8 位），留空则用后台初始化页 |
| `SITE_PUBLIC_URL` | `https://example.com` | 前端地址，用于 sitemap、邮件链接、IndexNow |
| `BACKEND_PUBLIC_URL` | `https://api.example.com` | 后端地址，写入 robots.txt |

## 站点默认值（可被后台覆盖）

| 变量 | 说明 |
| --- | --- |
| `SITE_NAME` | 站点名称 |
| `SITE_AVATAR` | 头像文字（1–2 字） |
| `SITE_TITLE` | 网页标题 |
| `SITE_SUBTITLE` | 副标题 / meta description |
| `SITE_GITHUB`、`SITE_X`、`SITE_TELEGRAM`、`SITE_EMAIL` | 首页社交链接 |
| `SITE_ICP`、`SITE_POLICE`、`SITE_MOE`、`SITE_FOOTER_EXTRA` | 页脚备案与补充说明 |
| `SITE_COPYRIGHT` | `0` 关闭版权声明 |
| `ADMIN_PATH` | 后台入口，默认 `admin` |

!!! note "后台优先"
    这些变量只是「首次启动时的默认值」，在后台改过之后以 `data/site.json` 为准。

## 功能开关

| 变量 | 说明 |
| --- | --- |
| `AUTH_DATA_DIR` | 覆盖 `data/` 目录位置（会话、凭据、友链、推送配置等） |
| `CAPTCHA_SECRET` | 评论验证码签名密钥，不填自动生成并存 `data/` |
| `IMAGE_WEBP_DISABLE` | `1` = 关闭上传自动转 WebP |
| `INDEXNOW_KEY` | IndexNow 密钥，也可在后台「索引推送」里配（后台优先） |
| `INDEXNOW_KEY_LOCATION` | 密钥文件地址，默认 `SITE_PUBLIC_URL/<key>.txt` |
| `PROBE_ENABLED` | `0` 关闭探针 |
| `PROBE_PROVIDER` | `cf` 或 `minimal` |
| `PROBE_URL` | 探针数据源地址 |
| `PROBE_PANEL_URL` | 「打开监控后台」按钮链接 |

## 运行时

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `PORT` | `33001` | 容器内监听端口 |
| `NODE_ENV` | `production` | |
| `TZ` | `Asia/Shanghai` | 影响日志时间 |
| `HOST_PORT` | `33001` | compose 里映射到宿主机的端口 |

## 前端（Cloudflare Pages）

| 变量 | 说明 |
| --- | --- |
| `SITE_URL` | 站点地址（canonical / sitemap） |
| `SITE_NAME` | 站名 |
| `SITE_BIO` | 站点描述 |
| `API_BASE_URL` | 后端地址（Functions 取文章用） |

## GUI 变量

`GF_*` 之类是宝塔等面板注入的，与本项目无关，忽略即可。

## 下一步

[接口速查 :material-arrow-right:](api.md){ .md-button .md-button--primary }
