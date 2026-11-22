# 域名与 HTTPS

前端在 Cloudflare 上，天然有 HTTPS；需要自己搞的是后端域名（`api.example.com`）——推荐「Cloudflare 代理 + 源站 Nginx + 只放行 Cloudflare 网段」。

## 1. DNS

| 记录 | 名称 | 内容 | 代理 |
| --- | --- | --- | --- |
| A | `api` | 你的服务器 IP | 🟠 已代理 |
| CNAME | `www` | `simple-blog.pages.dev` | 🟠 已代理 |
| A/CNAME | `@` | 跳转到 `www`（用 Redirect Rule） | 🟠 |

## 2. Nginx 反代

后端只监听 `127.0.0.1:33001`，由 Nginx 转发：

```nginx
server {
    listen 80;
    server_name api.example.com;

    client_max_body_size 32m;          # 上传图片/附件

    location / {
        proxy_pass http://127.0.0.1:33001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;   # 必须，决定 Cookie 是否带 Secure
        proxy_read_timeout 120s;
    }
}
```

!!! danger "`X-Forwarded-Proto` 不能少"
    后端靠它判断是否给 Cookie 加 `Secure`、以及 WebAuthn 的 origin 校验。漏掉会导致「登录后立刻掉线」或 Passkey 注册失败。

## 3. HTTPS

两种都行：

=== "Cloudflare 源站证书"

    Dashboard → SSL/TLS → Origin Server → 创建证书，把证书与私钥放到服务器，Nginx 里 `listen 443 ssl;` 引用；SSL 模式选 **Full (strict)**。

=== "Let's Encrypt"

    ```bash
    apt install -y certbot python3-certbot-nginx
    certbot --nginx -d api.example.com
    ```

## 4. 只允许 Cloudflare 回源

源站 IP 暴露后会被扫端口，建议让 80/443 只接受 Cloudflare 的 IP 段：

```bash
# Cloudflare 官方网段：https://www.cloudflare.com/ips-v4  https://www.cloudflare.com/ips-v6
for ip in $(curl -s https://www.cloudflare.com/ips-v4); do
  ufw allow from "$ip" to any port 80,443 proto tcp comment 'cf-only-web'
done
for ip in $(curl -s https://www.cloudflare.com/ips-v6); do
  ufw allow from "$ip" to any port 80,443 proto tcp comment 'cf-only-web'
done
ufw allow 22/tcp          # SSH，建议改成自己的端口
ufw enable
```

!!! warning "先放行 SSH 再开防火墙"
    顺序反了会把自己关在门外。面板端口（如果有）别忘了单独放行。

## 5. 验证

```bash
curl -s https://api.example.com/api/auth/status   # {"ok":true,...}
curl -sI https://api.example.com/ | grep -i 'set-cookie\|http/'  # 有 Secure
sudo ufw status numbered | head -20                # 80/443 只有 Cloudflare 段
```

直连 `http://<你的服务器IP>/` 应该是超时或拒绝，说明规则生效。

## 下一步

[搜索引擎与 SEO :material-arrow-right:](seo.md){ .md-button .md-button--primary }
