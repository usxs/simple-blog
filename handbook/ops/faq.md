# 常见问题

## 部署类

??? question "打开后台报 502 / Bad Gateway"
    容器没起来。依次看：

    ```bash
    docker compose ps                  # 是否 Exited / Restarting
    docker logs --tail 50 simple-blog-backend
    ```

    最常见是 `EACCES: permission denied` —— 宿主机目录不属于 UID 1000：

    ```bash
    sudo chown -R 1000:1000 data article Musings img file config.json
    docker compose up -d --force-recreate
    ```

??? question "提示「管理员数据目录不可写」"
    同上，权限问题。接口会返回 503 并给出提示，不会再让进程崩掉。

??? question "改了代码为什么不生效"
    镜像方式必须 `docker compose up -d --build`；只 `up -d` 用的是旧镜像。

??? question "`/admin` 打不开了，是不是坏了"
    可能改了后台入口。旧地址会返回 401 而不是 302（故意不暴露新入口）。查 `data/site.json` 里的 `adminPath`。

## 前端类

??? question "文章页样式全丢 / 变成裸 HTML"
    `index.html` 里资源用了相对路径 `./style.css`，在 `/post/<id>` 下会解析成 `/post/style.css`。用根路径 `/style.css`、`/app.js`。

??? question "Pages 上文章页没内容 / 没有 SEO 标签"
    多半是 `functions/` 没上传或者 Functions 没启用。检查部署产物里有没有 `functions/`，以及 `Settings → Functions` 是否开启。

??? question "改了 CSS/JS 但线上还是旧的"
    Cloudflare 边缘缓存默认 4 小时。改 `index.html` 里的 `?v=20260101-1` 版本号再部署，或者临时在 Dashboard 里 Purge Everything。

??? question "sitemap 打开是首页"
    说明请求被 SPA 兜底了（Functions 没生效）。要么确保 `frontend/functions/sitemap.xml.js` 被部署，要么用 `_redirects` 301 到后端：

    ```
    /sitemap.xml https://api.example.com/sitemap.xml 301
    ```

## 使用类

??? question "评论提交后看不到"
    默认需要审核。后台「评论审核 → 待审核」里通过。

??? question "验证码一直报错"
    验证码 10 分钟过期且一次性；同 IP 10 分钟最多 30 次，超了会锁 10 分钟。

??? question "上传图片失败"
    检查 `img/` 目录权限与磁盘空间；转换失败会自动降级保存原格式，不会让上传失败。

??? question "邮件发不出去"
    看后台测试邮件返回的提示：`找不到这个 SMTP 服务器`（域名/出网问题）、`535`（授权码不对）、`ECONNREFUSED`（端口与 SSL 不匹配）。

??? question "Bark 收不到"
    确认设备 Key 正确、服务器地址是 `https://api.day.app`（或你自建的），并在系统里允许通知。

??? question "Passkey 注册失败"
    必须 HTTPS；Nginx 要传 `X-Forwarded-Proto`；域名要稳定（换域名后旧 Passkey 失效）。

## 数据类

??? question "备份要备哪些"
    `config.json`、`article/`、`Musings/`、`img/`、`file/`、`data/`。详见 [备份与升级](backup.md)。

??? question "能直接用 SQLite/MySQL 吗"
    当前版本不支持，所有数据是文件。文章量上千、评论每天上百时建议评估换存储（见 [安全说明](../security.md)）。

??? question "忘记管理员密码"
    删掉 `data/auth.json` 重新初始化（会清空两步验证与通行密钥，内容不受影响）。

## 下一步

[排错手册 :material-arrow-right:](troubleshooting.md){ .md-button .md-button--primary }
