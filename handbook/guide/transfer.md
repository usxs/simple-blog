# 迁移与导入导出

后台「管理 → 迁移」把三件事放在一起：**搬去新版本**、**从静态博客进来**、**往静态博客出去**。

三块功能都只在本机后端跑，不依赖外网服务；数据不经过第三方。

---

## 三种版本的关系

| 版本 | 形态 | 数据存储 | 适合谁 |
| --- | --- | --- | --- |
| **V1**（`v1`） | Cloudflare Pages 前端 + 自托管 Node 后端 | `article/` 下的 Markdown 文件 + `data/*.json` | 想直接看文件、能 ssh 上服务器改的人 |
| **V2**（`v2-sqlite`） | Cloudflare Pages 前端 + Node 后端 | SQLite（一个 `.db` 文件） | 想要数据库的查询/事务能力，又保留前后端分离 |
| **V3**（`v3-monolith`） | 单进程：后端直接吐 HTML（SSR），不依赖 Pages | SQLite | 想一条命令跑起来、像 Typecho 一样前后端不分离 |

三个版本的文章正文都是**同一套 Markdown**，互相迁移不丢格式。V1 的 Markdown 文件里那段 `---` 前言，和 Hugo、Hexo 用的是同一种写法，所以静态博客的导入导出也不需要中间格式。

---

## V1 一键迁移到 V2 / V3

### 迁移包里有什么

点「下载 V2 迁移包」或「下载 V3 迁移包」，得到一个 ZIP：

```
manifest.json      格式标识（simple-blog-portable/1）、版本、统计、跳过的文件
data.json          文章（含正文与评论）、瞬间、栏目配置、站点/友链/通知等模块设置
uploads/img/...    图片原文件，路径与线上 /img/... 一一对应
uploads/file/...   附件原文件
README.md          这个包怎么用
```

「带上管理员账户」会把 `data/auth.json` 里的口令哈希一起打包，导入后**口令不变**，管理员还是同一个账号；不勾就只搬内容，目标站点用自己第一次初始化时的账号。

> 迁移包和「管理 → 备份」的 tar.gz 不是一回事：备份是整站（含代码）的灾备，迁移包只含数据，体积小、跨版本通用。

### 两种落地方式

**① 直接推送**（推荐，V2/V3 已经在跑的时候）

1. 在目标站点后台「管理 → 迁移」里复制**迁移令牌**（每个实例首次启动自动生成）。
2. 回到 V1 的「管理 → 迁移」，填目标地址（如 `https://v2.example.com`）、粘贴令牌，选导入方式：
   - **覆盖**：先清空目标站点的文章/瞬间/评论再导入，第一次搬家用这个；
   - **合并**：保留目标已有内容，ID 相同的文章会被覆盖。
3. 点「推送到目标站点」。V1 在服务端把包 POST 到 `目标 /api/migrate/import`，成功后目标站点返回导入条数。

推送走服务端到服务端，浏览器不需要下载再上传，几十兆的图片包也不会卡。

**② 下载再导入**

下载 ZIP，到目标站点后台「管理 → 迁移 → 从迁移包导入」上传；或者用目标仓库自带的命令行脚本：

```bash
# V2 / V3 仓库根目录
node scripts/import-portable.js --db ./data/blog.db --zip ./simple-blog-portable-20260101000000.zip --mode replace
```

命令行方式适合把数据塞进容器卷里的数据库文件，不需要先起服务。

### 目标站点（V2 / V3）这一侧

数据库版的后台「管理 → 迁移」顶部多一块「接收其它站点的推送」：

- **迁移令牌**：每个实例首次启动自动生成，存在数据库的 `kv` 表里，重置后旧令牌立刻失效。
- **接收地址**：`<你的后端地址>/api/migrate/import`，填到 V1 的推送框里。
- **直接上传迁移包**：不想开两个浏览器也行，选 zip、选覆盖/合并，点「导入迁移包」直接在本站落库。

命令行（容器内执行，不经过网络）：

```bash
# 推荐：先看只看统计（--db 指向容器卷里的库）
docker compose exec backend node scripts/import-portable.js --file /tmp/bundle.zip --mode replace
```

### 从 V1 的数据目录直接迁移（不打包）

服务器上同时有 V1 的目录和 V2 的代码时，可以直接读文件写库，省掉打包/上传：

```bash
cd backend
# --v1-dir 指 V1 的仓库根目录或 backend 目录（自动识别 article/ 在哪一层）
node scripts/migrate-v1-to-v2.js --v1-dir /srv/simple-blog --db ./data/blog.db

# 先空跑看看会搬多少东西
node scripts/migrate-v1-to-v2.js --v1-dir /srv/simple-blog --dry-run

# 不要图片附件 / 不要管理员凭据
node scripts/migrate-v1-to-v2.js --v1-dir /srv/simple-blog --no-uploads --no-auth
```

它会解析 `article/<id>/<id>.md`、`Musings/*.md`、`article/*/comments.json`、`config.json`、`data/*.json`，
把文章/瞬间/评论/列表配置写进 `posts`、`moments`、`comments`、`module_items` 表，站点设置与凭据写进 `kv` 表，
图片附件按原相对路径复制到 `img/`、`file/`。脚本结束会打印一份 JSON 统计（搬了多少篇、哪些文件被跳过）。

搬完想核对内容，可以临时用文件存储启动同一个镜像：

```bash
STORE=file node server.js   # 读的仍是 V1 的 Markdown 文件
```

---

## V2 → V3：直接复制数据库（后台已内置指引）

V2 和 V3 用同一套 SQLite schema（`schema_version = 2`），所以迁移不是「导包」，而是「换一个进程读同一个库」：

1. 停掉 V2，确认没有写入（`docker compose stop` 或 `pm2 stop simple-blog`）。
2. 把 V2 的 `data/`、`img/`、`file/` 覆盖到 V3 的对应目录。同机用 `cp -a`，跨机用 `rsync -a`；先停服再拷，避免 SQLite 的 `-wal` / `-shm` 和主库不一致。
3. 启动 V3，用 V2 原来的管理员账号登录。站点设置、友链、通知配置都在 `data/blog.db` 的 `kv` 表里，会一起带过来。

V2 后台「管理 → 迁移」和 V3 后台同一页会按版本显示这三步和可复制的命令；V1 的「一键迁移到 V2 / V3」只出现在 V1 后台。

> 不要用便携包做 V2 → V3：便携包在 SQLite 模式下只带文章、瞬间和图片，站点设置与管理员账号会丢（已在线验收确认）。便携包和 V1 推送仍然适合 V1 → V2 或 V1 → V3。

---

## 从静态博客导入

来源下拉框里选「自动识别」（默认）就让程序自己判断，也可以手动指定。

| 来源 | 默认取的目录 | 前言格式 |
| --- | --- | --- |
| Hugo | `content/**` | YAML `---` 或 TOML `+++` |
| Hexo | `source/_posts/**` | YAML |
| Jekyll | `_posts/**` | YAML |
| Astro | `src/content/**` | YAML |
| Ghost | `content/**` | YAML |
| Obsidian | 全库 `*.md` | YAML |
| 通用 Markdown | 任意目录 | YAML |

处理规则：

- **跳过** `node_modules`、`.git`、`themes`、`public`、`_site`、`dist`、`build`、`vendor` 等目录；跳过 `README.md`、`CHANGELOG.md` 之类的说明文件；Hugo 的 `_index.md`（栏目首页）不算文章。
- **标题**取 `title`，没有就用文件名；**日期**取 `date`/`pubDate`/`published`/`created`，带时区的会换算成北京时间，纯日期原样保留；**标签**取 `tags`，字符串或数组都认；`draft: true`、`published: false`、`hidden: true` 一律导入成「在前端隐藏」。
- **图片**：正文里 `![x](cover.png)`、`![x](/img/a.png)`、`<img src="...">` 指向 ZIP 内的文件时，会把图片解到 `img/imported/<文章ID>/` 并把正文链接改写成 `/img/imported/<文章ID>/cover.png`。
- **ID 冲突**自动加后缀：已有 `hello-world` 就存成 `hello-world-2`。
- 导入前建议先点「预检」：它只解析、不落盘，返回识别到的博客类型、文章数、图片数、警告，以及每篇的标题/日期/标签/字数。

单个 `.md` 文件也能直接导入（来源选「通用 Markdown」），适合从别处拷一篇过来。

---

## 导出为静态博客

| 目标 | 产物 | 放到哪 |
| --- | --- | --- |
| Hugo | `content/posts/<id>.md` + `hugo.toml.fragment` + `static/img/...` | 对应目录直接覆盖 |
| Hexo | `source/_posts/<id>.md` + `_config.yml.fragment` + `source/img/...` | 同上 |
| Jekyll | `_posts/YYYY-MM-DD-<id>.md` + `img/...` | 仓库根目录 |
| Astro | `src/content/posts/<id>.md` + `src/content/config.ts.fragment` + `public/img/...` | 项目根目录 |
| Ghost | `content/<id>.md` + `ghost-import.json` | JSON 走 Ghost 后台 Labs → Import |
| Obsidian | `vault/<标题>.md` + `img/...` | 直接丢进库 |
| 通用 Markdown | `posts/<id>.md` + `manifest.json` + `img/...` | 给 VuePress、Eleventy、Next.js 等自取 |

细节：

- 日期统一写成带 `+08:00` 的 RFC3339，Hugo 读得懂、Jekyll 的 `layout: post` 也能直接用。
- 「在前端隐藏」的文章导出成 `draft: true`（Ghost 是 `status: draft`），静态站点构建时默认不发布。
- 正文里 `/img/xxx` 的图片会从图片目录捞出来，按各家的静态目录规则一起打包（Hugo → `static/`，Hexo → `source/`，Astro → `public/`，其余 → 包根的 `img/`）。
- 每个包都带 `README.md`，写清目录约定和需要合并的配置片段。
- `manifest.json` 里有每篇的 id / 标题 / 日期 / 标签 / 文件名，方便写脚本做二次处理。

---

## 写作页的三种视图

写作页顶部有三个按钮，也可以按 <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> 切换：

| 视图 | 看到什么 | 什么时候用 |
| --- | --- | --- |
| **内容** | 只有 Markdown 源码，占满整行 | 长文写作、贴代码 |
| **预览** | 只有渲染后的效果 | 检查排版、图片、表格 |
| **对照** | 左边源码、右边渲染，滚动不联动 | 边写边看 |

窄屏（<640px）下「对照」会退化成一上一下。上次选的视图记在浏览器里，下次打开还是它。

---

## 常见问题

**导入后中文乱码？**
ZIP 里的文件名按 UTF-8 解析；如果来源是 Windows 上用 GBK 打的包，建议先解压再重新压缩成 UTF-8，或者只上传 `.md` 文件。

**迁移包几百兆，推送超时？**
推送的超时是 120 秒。图片特别多时先不勾「带上图片与附件」，只搬文章，图片后续用 rsync 同步 `img/` 目录——两边的相对路径是一致的。

**V2 / V3 的迁移令牌在哪？**
目标站点后台「管理 → 迁移」顶部，随实例首次启动生成并存在数据库 `kv` 表里，可在同一页重置。

**能不能来回导？**
可以。V1 → Hugo → V1 走一圈，标题、日期、标签、隐藏状态、正文都保持不变；图片会因为重新落到 `img/imported/` 而换路径，正文链接会同步改写，不影响显示。
