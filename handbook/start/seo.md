# 搜索引擎与 SEO

这套站点从一开始就是按「能被搜索引擎读懂」做的：真实路径路由、边缘 SSR、动态 sitemap、IndexNow。部署完只差一步——去提交。

## 已经做好的部分

- **真实路径**：`/posts`、`/post/<id>`、`/links` 等，不再是 `#/` 哈希
- **SSR**：文章页由 Pages Functions 注入标题、正文、canonical、Open Graph、`BlogPosting` JSON-LD
- **sitemap**：`https://www.example.com/sitemap.xml`，发布/删除文章后即时更新，已启用栏目才收录
- **robots.txt**：前端 `Allow: /` 并指向 sitemap；后端 `Disallow: /` 只放行 `/sitemap.xml`
- **旧链接兼容**：`#/post/x` 会自动跳到 `/post/x`

自检：

```bash
curl -s https://www.example.com/sitemap.xml | grep -c '<url>'     # 数量 = 固定页 + 文章数
curl -s https://www.example.com/post/<id> | grep -o '<title>[^<]*'
curl -s https://www.example.com/robots.txt
```

## 1. Google Search Console

1. 添加资源，**用「网域」类型**（DNS TXT 验证），而不是「网址前缀」——后者只能收一个子域，`www` 与 `api` 会被判「无法读取站点地图」。
2. 提交 `https://www.example.com/sitemap.xml`。
3. 用「网址检查」抓一个文章页，确认「已编入索引」。

!!! tip "常见误报"
    GSC 里 sitemap 显示「无法读取」多半是资源类型选错（裸域 vs www vs 子域不匹配），或者刚提交还没抓。

## 2. Bing Webmaster Tools

1. <https://www.bing.com/webmasters>，可以直接 **Import from Google Search Console**。
2. 同样提交 sitemap。

## 3. IndexNow（可选，加速收录）

Bing / Yandex / Seznam / Naver 支持 IndexNow：发布文章时主动推送 URL。

1. 生成密钥：`openssl rand -hex 16`
2. 部署密钥文件：把内容为密钥的 `密钥.txt` 放到**前端根目录**（`frontend/密钥.txt`），确保 `https://www.example.com/密钥.txt` 能访问。
3. 后台「管理 → 索引推送」填入密钥保存，点「检查密钥文件」确认通过。

之后每次发布/删除文章，后端会自动 POST 到 `api.indexnow.org`。没配也不影响使用，只是收录慢一点。

## 4. 注意事项

- 改了前端资源记得改 `index.html` 里的 `?v=` 版本号——Cloudflare 边缘缓存默认 4 小时，否则用户/爬虫可能拿到旧文件。
- 改名、改栏目路径后，sitemap 与导航会同步更新，但旧 URL 不会自动 301；如有需要可以在 Pages 里加 `_redirects`。
- 评论、后台、`/api/*` 都不该被收录，已经通过 `robots.txt` 与 `X-Robots-Tag` 规避。

## 下一步

[登录与后台 :material-arrow-right:](../guide/admin.md){ .md-button .md-button--primary }
