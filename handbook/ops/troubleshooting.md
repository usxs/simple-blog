# 排错手册

按「从里往外」的顺序排查：容器 → 后端接口 → Nginx → Cloudflare → 前端。

## 1. 容器

```bash
docker compose ps
docker logs --tail 100 simple-blog-backend
docker inspect --format '{{.State.Health.Status}}' simple-blog-backend
```

对照日志：

| 日志 | 含义 | 处理 |
| --- | --- | --- |
| `EACCES: permission denied` | 目录权限 | `chown -R 1000:1000 <目录>` 后重建容器 |
| `EADDRINUSE` | 端口被占 | 改 `HOST_PORT`，或停掉旧容器 |
| `Cannot find module './backend/xxx'` | 构建上下文缺文件 | 确认 `backend/backend/*.js` 都在仓库里，重新 `--build` |
| `EACCES ... .tmp` | 单文件挂载无法原子写 | 已内置降级直写；仍有问题就确认 `config.json` 是文件不是目录 |
| 反复 restarting | 上面任一原因 | 先 `docker compose logs` 看第一行错误 |

## 2. 后端本身

```bash
curl -s http://127.0.0.1:33001/api/auth/status
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:33001/sitemap.xml
curl -s http://127.0.0.1:33001/api/site | head -c 200
```

- `status` 里 `dataWritable:false` → 权限
- `sitemap.xml` 非 200 → 文件系统读不到 `article/`
- 全部 200 说明后端没问题，问题在反代或 DNS

## 3. Nginx

```bash
nginx -t
tail -n 50 /var/log/nginx/error.log
curl -H 'Host: api.example.com' http://127.0.0.1/api/auth/status
```

| 现象 | 原因 |
| --- | --- |
| `502 Bad Gateway` | 上游没起来 / 端口不对 |
| `504` | 上游卡住（多为上传大文件超时） |
| 登录后立刻掉线 | 少了 `X-Forwarded-Proto`，Cookie 没带 `Secure` 或 origin 校验失败 |
| `413 Request Entity Too Large` | `client_max_body_size` 太小（建议 32m） |

## 4. Cloudflare

- `curl -sI https://api.example.com/` 看 `cf-ray`、`server: cloudflare`
- 502/522 是 Cloudflare 到源站不通：确认源站防火墙放行了 Cloudflare 网段
- 缓存导致的「改了没生效」：Dashboard → Caching → Purge Everything，或给静态资源加 `?v=` 版本号

```bash
# 确认走的是 Cloudflare 而不是直连源站
curl -sI https://www.example.com/ | grep -i 'cf-cache-status\|server'
```

## 5. 前端

浏览器控制台优先看：

| 报错 | 排查 |
| --- | --- |
| `Failed to fetch` / CORS | 后端 CORS 白名单、`apiBaseUrl` 是否正确、`Origin` 是否同源 |
| `401 Unauthorized` | 会话过期，重新登录后台 |
| `403 拒绝跨站请求` | 请求带了别的 `Origin`（常见于本地用前端端口访问后端） |
| 页面空白 | `/app.js` 404（路径用相对路径，见 [FAQ](faq.md#前端类)） |
| 样式错乱 | 缓存旧 CSS，加版本号 |

## 6. 快速体检脚本

```bash
#!/usr/bin/env bash
set -u
api=${1:-https://api.example.com}
web=${2:-https://www.example.com}
for u in "$api/api/auth/status" "$api/sitemap.xml" "$api/robots.txt" \
         "$web/" "$web/posts" "$web/sitemap.xml" "$web/app.js"; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$u")
  echo "$code  $u"
done
```

## 7. 还是没有头绪

收集这些信息再提问：

```bash
docker compose ps
docker logs --tail 200 simple-blog-backend > /tmp/be.log 2>&1
docker inspect simple-blog-backend | head -40
curl -s http://127.0.0.1:33001/api/auth/status
```

!!! danger "别公开贴日志里的敏感信息"
    日志与 `data/*.json` 里可能有 IP、邮箱、会话 ID。贴之前删掉。
