---
hide:
  - navigation
  - toc
---

<div class="sb-hero">
  <img class="sb-hero__logo" src="images/logo.svg" alt="简单博客" width="84" height="84" />
  <h1 class="sb-hero__title">简单博客</h1>
  <p class="sb-hero__tagline">一套可以自己部署的极简个人博客系统</p>
  <p class="sb-hero__desc">
    静态前端放在 Cloudflare Pages，后端跑在自己的服务器上，数据全部以 Markdown / JSON 落在磁盘里。
    没有数据库，没有第三方依赖，一条 <code>docker run</code> 就能跑起来。
  </p>
  <p class="sb-hero__actions">
    <a class="md-button md-button--primary" href="start/prerequisites/">快速开始</a>
    <a class="md-button" href="guide/admin/">使用手册</a>
    <a class="md-button" href="https://github.com/usxs/simple-blog">GitHub</a>
  </p>
</div>

<div class="sb-features">

<div class="sb-feature">
<div class="sb-feature__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></div>
<h3>写文章与瞬间</h3>
<p>Markdown 写作，代码高亮、Mermaid 流程图、图片灯箱；长文短句都能直接发布。</p>
</div>

<div class="sb-feature">
<div class="sb-feature__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8Z"/></svg></div>
<h3>评论与审核</h3>
<p>访客免登录留言，算术验证码与频率限制防刷，后台审核、回复，回复可以发邮件通知。</p>
</div>

<div class="sb-feature">
<div class="sb-feature__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.1 0l3-3a5 5 0 0 0-7.1-7.1L11.6 4.3"/><path d="M14 11a5 5 0 0 0-7.1 0l-3 3a5 5 0 0 0 7.1 7.1l1.4-1.4"/></svg></div>
<h3>友链</h3>
<p>访客自助提交，站长审核、驳回并填写原因；管理员也能手动新增，图标直接上传。</p>
</div>

<div class="sb-feature">
<div class="sb-feature__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg></div>
<h3>通知推送</h3>
<p>新评论、友链申请、后台爆破等事件，走邮件或 Bark 推送到手机；模板可在后台改。</p>
</div>

<div class="sb-feature">
<div class="sb-feature__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg></div>
<h3>账号安全</h3>
<p>账密登录、两步验证、通行密钥、会话管理，登录失败过多会锁 IP 并推送提醒。</p>
</div>

<div class="sb-feature">
<div class="sb-feature__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="6" rx="1.5"/><rect x="2" y="14" width="20" height="6" rx="1.5"/><path d="M6 7h.01M6 17h.01"/></svg></div>
<h3>Docker 部署</h3>
<p>镜像已发布到 Docker Hub，<code>docker run</code> 或 <code>compose up</code> 即可；升级只换标签。</p>
</div>

</div>

## 从这里开始

<div class="sb-links">

<a class="sb-link" href="start/prerequisites/"><strong>部署前准备</strong><span>域名规划、Docker、目录权限</span></a>

<a class="sb-link" href="start/backend/"><strong>部署后端</strong><span>用现成镜像，或从源码构建</span></a>

<a class="sb-link" href="start/frontend/"><strong>部署前端</strong><span>Cloudflare Pages 两种方式</span></a>

<a class="sb-link" href="start/https/"><strong>域名与 HTTPS</strong><span>Nginx 反代、证书、防火墙</span></a>

<a class="sb-link" href="ops/faq/"><strong>常见问题</strong><span>部署、前端、数据相关疑问</span></a>

<a class="sb-link" href="ops/troubleshooting/"><strong>排错手册</strong><span>从容器到浏览器的分层排查</span></a>

</div>
