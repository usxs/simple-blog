# Simple Blog

[简体中文](README.md) · **English**

[![License](https://img.shields.io/badge/license-MIT-555?logo=opensourceinitiative&logoColor=white)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A520%20%C2%B7%20V2%2FV3%20%E2%89%A522.5-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Cloudflare Pages](https://img.shields.io/badge/Cloudflare%20Pages-deployed-F38020?logo=cloudflare&logoColor=white)](https://pages.cloudflare.com)
[![Docs](https://img.shields.io/badge/docs-usxs.github.io%2Fsimple--blog-555?logo=readthedocs&logoColor=white)](https://usxs.github.io/simple-blog/)

[![GHCR](https://img.shields.io/badge/ghcr.io-usxs%2Fsimple--blog--backend-2496ED?logo=github&logoColor=white)](https://github.com/usxs/simple-blog/pkgs/container/simple-blog-backend)
[![Version](https://img.shields.io/github/v/tag/usxs/simple-blog?logo=git&logoColor=white)](https://github.com/usxs/simple-blog/releases)
[![Stars](https://img.shields.io/github/stars/usxs/simple-blog?logo=github&logoColor=white)](https://github.com/usxs/simple-blog/stargazers)
[![Last commit](https://img.shields.io/github/last-commit/usxs/simple-blog?logo=git&logoColor=white)](https://github.com/usxs/simple-blog/commits/main)

**Docs**: <https://usxs.github.io/simple-blog/> (deployment guide, handbook, FAQ)

**Simple Blog — anything but simple.**

A minimal, self-hosted personal blog. The repository ships three variants on three branches — same content model, same API, only the renderer and the storage differ:

- **V1** (`main`, Docker `latest`): Cloudflare Pages static frontend + self-hosted Node backend, data stored as Markdown / JSON files
- **V2** (`v2-sqlite`, Docker `v2`): same two-tier deployment, backend switched to SQLite (Node's built-in `node:sqlite`, no third-party driver)
- **V3** (`v3-monolith`, Docker `v3`): frontend and backend in one process, SQLite + in-process SSR — Cloudflare Pages not required

The frontend is a build-free static SPA (HTML/CSS/vanilla JS): on V1/V2 Pages Functions inject SSR at the edge, on V3 the Node process renders the same HTML itself. Both paths hand search engines the full article text. The backend is a zero-framework Node service handling login, content management, image uploads and comments.

> For people who want to own their data without a build toolchain: pick V1 for files you can copy anywhere, V2 for sturdier writes, V3 to run everything on one box. All three can migrate into each other — V1's *Settings → Transfer* bundles everything into a `.zip` (download or push), V2/V3 accept it with a token, and `backend/scripts/` covers the CLI route.

---

## Screenshots

> Taken from a locally running instance with demo data. The site ships light and dark themes that follow your device / system setting.

### Front end

| Home | Post list |
| --- | --- |
| ![Home](docs/screenshots/home.png) | ![Post list](docs/screenshots/posts.png) |
| <sub>Home: avatar, one-line bio and social links; node status and filing badges in the sidebar</sub> | <sub>Post list: newest first, fuzzy search over title / excerpt / tags</sub> |

| Post detail | Comments |
| --- | --- |
| ![Post detail](docs/screenshots/article.png) | ![Comments](docs/screenshots/comments.png) |
| <sub>Post detail: Markdown rendering, language label and line numbers, MIT notice</sub> | <sub>Comments: arithmetic captcha, threaded replies, aligned with the article</sub> |

| Moments | Links |
| --- | --- |
| ![Moments](docs/screenshots/moment.png) | ![Links](docs/screenshots/links.png) |
| <sub>Moments: short notes, newest first; can be mirrored to a Telegram channel</sub> | <sub>Links: falls back to the first character when no icon is given</sub> |

| Apply for a link |
| --- |
| ![Apply for a link](docs/screenshots/links-apply.png) |
| <sub>Apply: URL, name, icon URL and an optional email — nothing is uploaded to your server</sub> |

### Admin

| Login | Posts |
| --- | --- |
| ![Login](docs/screenshots/admin-login.png) | ![Admin](docs/screenshots/admin.png) |
| <sub>Login: password + server-side session, optional 2FA and passkeys</sub> | <sub>Posts: content / preview / compare views, encrypted posts auto-unlocked, image upload, comment moderation</sub> |

| Links review | Notifications |
| --- | --- |
| ![Links review](docs/screenshots/admin-links.png) | ![Notifications](docs/screenshots/admin-notify.png) |
| <sub>Links review: pending / approved / rejected, reject with a reason, add links manually</sub> | <sub>Notifications: SMTP mail and Bark, with per-channel switches for the site owner</sub> |

| Template editor | Moment sync |
| --- | --- |
| ![Template editor](docs/screenshots/admin-notify-templates.png) | ![Moment sync](docs/screenshots/admin-telegram.png) |
| <sub>Template editor: eight templates in three groups, variables allowed</sub> | <sub>Moment sync: posts to a Telegram channel, re-sends on edit, deletes on removal</sub> |

| Settings (site & sections) | Account security |
| --- | --- |
| ![Settings](docs/screenshots/admin-settings.png) | ![Account security](docs/screenshots/admin-settings-account.png) |
| <sub>Settings: site info, sections, footer filings, social links and admin path</sub> | <sub>Account security: username, 2FA, passkeys, sessions</sub> |

### Mobile

On phones the sidebar collapses into a **liquid-glass bottom bar** that hides on scroll down and returns on scroll up (except on the home page); the current section is marked by a sliding capsule. Spacing is compressed from 375px (iPhone SE) to 430px so all eight entries fit on one row — article text, code blocks, the comment form and the captcha all reflow without horizontal scrolling.

| Mobile home | Mobile post list |
| --- | --- |
| ![Mobile home](docs/screenshots/mobile-home.png) | ![Mobile post list](docs/screenshots/mobile-posts.png) |
| <sub>Glass bottom bar with a sliding capsule</sub> | <sub>Single-column cards with excerpts and tags</sub> |

| Mobile post detail | Mobile links |
| --- | --- |
| ![Mobile post](docs/screenshots/mobile-article.png) | ![Mobile links](docs/screenshots/mobile-links.png) |
| <sub>Article body and code blocks reflow to the width</sub> | <sub>One-card-per-row list with the apply button on top</sub> |

## Features

| Area | Description |
| --- | --- |
| Authentication | Username/password with salted `scrypt`, server-side session cookies (HttpOnly / SameSite=Strict), login rate limiting and CSRF protection |
| Settings page | Site info (name / avatar text / browser title / subtitle), username and password change, 2FA, passkeys and session management in one place; changes apply immediately without redeploying |
| Two-factor (2FA) | Standard TOTP (RFC 6238) — scan with Google Authenticator / 1Password, then enter the 6-digit code on login; 10 single-use backup codes |
| Passkeys | WebAuthn fingerprint / face / security-key login; the server stores public keys only, supports multiple devices, also usable as a passwordless login entry |
| Posts | Markdown authoring with three switchable views — content, preview, compare (<kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>1</kbd> / <kbd>2</kbd> / <kbd>3</kbd>); date archives and date ordering |
| Markdown | Headings, nested lists, nested blockquotes, horizontal rules, tables with alignment, task lists, inline styles; fenced code with language label, line numbers, copy button and zoom lightbox; ```` ```mermaid ```` diagrams rendered in the browser |
| Sections | Multiple independently maintained content sections (moments, tools, status, quirky) sharing one CRUD API |
| Image upload | Paste or pick an image in the admin; the server converts it to WebP and caps the long edge at 2560px — the original never touches disk |
| Comments | Visitor comments with captcha, moderation queue, threaded replies, optional contact field (never public) |
| SEO | Real-path routing, per-article SSR, dynamic `sitemap.xml`, `robots.txt`, Open Graph, JSON-LD, IndexNow push (configurable in the admin) |
| Details | A compact “back to top” button appears once a page is longer than the viewport; Settings uses top tabs (General / Security / Integrations / Backup), and sidebar shortcuts jump straight to the matching tab |
| Server probe | The admin sidebar "Probe" page can switch data sources: CF-Server-Monitor (`/api/servers`) or the minimal monitor probe (`/api/nodes`); both are normalized into the same cards |
| Section toggles | Decide per section whether it appears on the frontend ("Settings → Sections"); disabled sections are hidden from the nav and their URLs show a "closed" placeholder page |
| Section customization | Rename (≤ 12 chars), change the URL path (e.g. `/moment` → `/diary`), pick one of 16 built-in icons or upload your own PNG / JPG / SVG / WebP |
| Section ordering | Drag the ⋮⋮ handle in "Settings → Sections"; desktop sidebar, mobile dock and admin sidebar all follow the new order (persisted in `data/site.json`) |
| Custom paths | Sections can use custom paths such as `/diary`; old URLs keep working and redirect, and nav links, `sitemap.xml` and SSR metadata follow the new path |
| Footer & filings | ICP / police / Moe-ICP filing numbers are editable in the admin (empty = hidden). The public site shows icon-only badges: hover to read the number, click to open the official lookup page. The `© year name · All Rights Reserved.` line has its own on/off switch. Everything sits at the bottom of the sidebar and is hidden below 860px; the monochrome icons follow the light/dark theme |
| Friend links | A dedicated `/links` page where visitors submit their site (URL, name, icon URL — no file uploads); submissions wait for review. Without an icon the first character of the site name is used. The admin **Links** page groups them by pending / approved / rejected with approve, reject, edit and delete |
| Notifications | Configure SMTP email and Bark push under **Push**. Notifications **to visitors** (comment replies, link review results) always go out by email; notifications **to the admin** (new comments, link applications, security alerts) can be routed to email, Bark, or both via checkboxes. Eight templates in three groups are editable with a one-click reset; emails use a dark outer frame with a light grey body card |
| Configurable admin path | The dashboard lives at `/admin` by default; change it under **Manage → Site info** to any 2–24 character slug. The old path returns 401 instead of redirecting, so the new entry stays hidden |
| Telegram sync | Turn it on in **Manage → Moment sync**; every new or edited moment is posted to your Telegram channel (images included, up to 4) and deleting a moment removes the message. A **Send test message** button verifies the bot/channel pairing |
| Admin UI | Every replaceable binary option is a Switch; the post editor uses a proof-sheet layout with no emoji icons; the workspace has content / preview / compare views with monospace pane labels and keycap hints |
| Docker image | One image for V1 / V2 / V3 — `ghcr.io/usxs/simple-blog-backend` with stable tags `latest`, `v2`, `v3`; multi-arch (`linux/amd64` + `linux/arm64`), built per branch by GitHub Actions; on V3 a single container serves both site and admin |
| Deploy version | Hover the sidebar "Node ONLINE" badge to see the deployed short version, commit and branch |
| Post search | The post-list search box matches title / excerpt / tags; Chinese by substring, English by subsequence; filters as soon as IME composition ends, supports Enter and Esc without rebuilding the input |
| Mobile | Below 860px the layout collapses to one column and a floating dock appears; the dock is a frosted glass panel with specular highlights and a glass selection pill; it auto-hides when scrolling down and returns when scrolling up, fitting all 7 entries even at 320–430px |
| Progressive loading | Site config (section toggles / names / paths / order) is cached in the browser: first paint already matches the last known config, no flash of hidden sections; the home page never waits for the network, node status and probe data refresh on their own; the frontend stays readable when the backend is down |

## Architecture

All three variants share one content model and one API. Only two things change: who renders the HTML, and where the data lives.

**V1 / V2 — two tiers**

```
Visitor browser
   │  HTTPS
   ▼
Cloudflare Pages (static frontend)
   │  /post/<id>, /posts etc. are SSR-injected by Pages Functions at the edge
   │  /api/* is not on Pages — it calls the backend cross-origin
   ▼
Your server: Nginx → Docker container (Node 22 + sharp)
   │
   ├─ V1: article/ Musings/ config.json img/ file/ … plain files on the host
   └─ V2: data/blog.db (SQLite, WAL) + img/ file/ … images stay on disk
```

**V3 — single process**

```
Visitor browser
   │  HTTPS
   ▼
Your server: Nginx → Docker container (Node 22)
   │
   ├─ /, /post/<id>, section pages → rendered in-process by backend/web/ssr.js
   ├─ /app.js, /style.css          → static assets in backend/web/
   ├─ /api/*, /admin*              → Node routes in the same process (same origin)
   └─ data: data/blog.db (SQLite) + img/ file/
```

- **Frontend**: `frontend/` on V1/V2 (Pages publishes that directory as-is); `backend/web/` on V3, served by the same process.
- **Backend**: `backend/`, Node's native `http` module with a single dependency (`sharp` for WebP); SQLite uses the built-in module, no driver dependency.
- **Storage**: files on V1 (`article/<id>/<id>.md` plus JSON); SQLite on V2/V3 (`data/blog.db`), with post bodies kept as raw Markdown — `STORE=file` switches back to file storage.


## Project structure

```
simple-blog/
├── README.md                 # this file (Chinese: README.md, English: README.en.md)
├── CHANGELOG.md              # changelog
├── LICENSE                   # MIT
├── backend/                  # backend service (identical on all three variants)
│   ├── server.js             # entry: routes, static files, SSR, public API
│   ├── admin.html/css/js     # admin UI (login, editor, uploads, moderation)
│   ├── markdown.js           # Markdown renderer shared by frontend and backend
│   ├── web/                  # V3 frontend (V1/V2 keep it in frontend/)
│   │   ├── index.html        # SPA shell; SSR injects content and meta
│   │   ├── app.js            # routing, rendering, comments
│   │   ├── style.css
│   │   └── ssr.js            # in-process SSR: posts, section pages, meta
│   ├── backend/
│   │   ├── auth.js           # password, sessions, rate limit, CSRF, 2FA, passkeys
│   │   ├── captcha.js        # comment captcha
│   │   ├── storage.js        # storage dispatch: file or sqlite, per STORE
│   │   ├── storage-file.js   # V1 file storage: Markdown + JSON
│   │   ├── storage-db.js     # V2/V3 SQLite storage (same function signatures)
│   │   ├── db.js             # node:sqlite connection, schema, WAL, transactions
│   │   ├── kvfile.js         # config JSON → kv table in DB mode
│   │   ├── mdparse.js        # Markdown front-matter parse and build
│   │   ├── frontmatter.js    # YAML / TOML front-matter parser
│   │   ├── text.js           # excerpts, search ranking, filename sanitizing
│   │   ├── image.js          # WebP conversion and resizing
│   │   ├── site.js           # site info, sections, paths, order, probe config
│   │   ├── probe-source.js   # CF / minimal probe adapters
│   │   ├── sitemap.js        # dynamic sitemap
│   │   ├── indexnow.js       # IndexNow push
│   │   ├── links.js          # friend links: apply, review, rate limit
│   │   ├── notify.js         # email / Bark notifications and templates
│   │   ├── mailer.js         # zero-dependency SMTP client
│   │   ├── telegram.js       # moment sync to a Telegram channel
│   │   ├── portable.js       # portable `.zip` bundle packing / unpacking
│   │   ├── transfer.js       # admin "transfer" endpoints
│   │   ├── migrate-import.js # receive side: token check, bundle into the DB
│   │   ├── mdimport.js       # static blog → posts
│   │   ├── mdexport.js       # posts → static blog
│   │   ├── zip.js            # zero-dependency ZIP read/write
│   │   └── probe.js          # uptime probes for the status page
│   ├── scripts/              # CLI migration and import/export
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── .env.example
│   ├── config.json           # empty seeds for tools/status/quirky (V1 / STORE=file)
│   └── data/                 # runtime: blog.db, auth.json, sessions.json, site.json …
├── frontend/                 # V1 / V2 static site (Cloudflare Pages); merged into backend/web on V3
│   ├── index.html
│   ├── app.js                # routing, rendering, comments, site-config cache
│   ├── style.css
│   ├── markdown.js
│   ├── robots.txt
│   ├── _redirects
│   └── functions/            # Pages Functions: SSR for posts/lists, sitemap proxy, /version
└── docs/
    ├── DEPLOY.md             # detailed deployment and troubleshooting
    ├── API.md                # API reference
    └── screenshots/          # screenshots used by the READMEs
```

## Quick start

Below is the full path from zero to a working site, in order. Each step has a verification command so problems can be located immediately.

### 0. Prerequisites

| Need | Notes |
| --- | --- |
| A server | Linux (Debian/Ubuntu); 1 vCPU / 1 GB RAM is enough; VPS or a home box, as long as it is reachable from the internet |
| A domain | Two subdomains recommended: `www.example.com` for the frontend, `api.example.com` for the backend; V3 needs only one (site and admin share it) |
| A Cloudflare account | V1 / V2 only — the frontend is hosted on Pages for free; V3 skips this |
| Docker | Docker Engine + Compose plugin installed on the server (checked in step 2.1) |

### 1. Clone (do you need to fork?)

**No fork is required to deploy everything.** Forking only matters if you want automatic deployments from Git, or you plan to modify the code.

| Your situation | What to do |
| --- | --- |
| Just want it running, no code changes | `git clone` this repository (or download the ZIP). Upload the frontend with `wrangler` — no copy under your own account needed |
| Want Cloudflare Pages connected to a repo so pushes auto-deploy | You need a repository **under your own account**: click **Fork**, or clone and push to a new empty repo |
| Plan to maintain and modify the code | Same as above — fork (or create your own repo) and change the URLs |

```bash
# case 1: deploy only, no fork
git clone https://github.com/usxs/simple-blog.git
cd simple-blog

# case 2/3: already forked to your account
git clone https://github.com/<your-name>/simple-blog.git
cd simple-blog
```

> A fork does not track upstream automatically. To sync later, click **Sync fork** on GitHub, or locally `git remote add upstream https://github.com/usxs/simple-blog.git && git fetch upstream && git merge upstream/main`.

### 2. Deploy the backend (on the server)

#### 2.0 Use the published image (recommended, no source needed)

The image is published to GHCR (GitHub Container Registry): <https://github.com/usxs/simple-blog/pkgs/container/simple-blog-backend>, publicly pullable and built for `linux/amd64` and `linux/arm64`. Each branch has a stable tag:

| Tag | Variant | What you get |
| --- | --- | --- |
| `latest` | V1 | Node backend with file storage; the frontend still goes to Cloudflare Pages |
| `v2` | V2 | Node backend with SQLite; the frontend still goes to Cloudflare Pages |
| `v3` | V3 | **Site + admin in one container**, no Pages needed |

Stable tags move with their branches. To pin one build, use the short SHA tag CI produces (e.g. `sha-3a1b2c4`), or push a tag such as `v3.0.0` so CI also emits `3.0.0` / `3.0` / `3`. Roll back the same way.

**V3: the shortest path, one container**

```bash
mkdir -p blog && cd blog
mkdir -p data img file
sudo chown -R 1000:1000 data img file

docker run -d --name simple-blog --restart unless-stopped \
  -p 127.0.0.1:33001:33001 \
  -v "$PWD/data:/app/data" -v "$PWD/img:/app/img" -v "$PWD/file:/app/file" \
  -e ADMIN_USERNAME=admin -e ADMIN_PASSWORD='a-strong-password' \
  -e SITE_PUBLIC_URL='https://blog.example.com' \
  ghcr.io/usxs/simple-blog-backend:v3
```

Once it is up, `http://127.0.0.1:33001/` on the server is the site and `/admin` on the same origin is the admin; put Nginx in front when you are ready. V3 needs no `BACKEND_PUBLIC_URL` and no frontend deployment.

**V1 / V2: the image is the backend only**

Full command for V1 (file storage):

```bash
mkdir -p blog-backend && cd blog-backend
mkdir -p data article Musings img file && touch config.json
sudo chown -R 1000:1000 data article Musings img file config.json

docker run -d --name simple-blog-backend --restart unless-stopped \
  -p 127.0.0.1:33001:33001 \
  -v "$PWD/config.json:/app/config.json" \
  -v "$PWD/article:/app/article" -v "$PWD/Musings:/app/Musings" \
  -v "$PWD/img:/app/img" -v "$PWD/file:/app/file" -v "$PWD/data:/app/data" \
  -e ADMIN_USERNAME=admin -e ADMIN_PASSWORD='a-strong-password' \
  -e SITE_PUBLIC_URL='https://www.example.com' \
  -e BACKEND_PUBLIC_URL='https://api.example.com' \
  ghcr.io/usxs/simple-blog-backend:latest
```

For V2 use `:v2`; SQLite only needs `data` (the database is `data/blog.db`), `img` and `file`. The `config.json`, `article` and `Musings` mounts are only required with `STORE=file`.

Or use the bundled `docker-compose.hub.yml` with the same `.env`. V3 is shown below; for V1 / V2 switch the branch in the URLs to `main` / `v2-sqlite` and check `IMAGE_TAG`:

```bash
curl -O https://raw.githubusercontent.com/usxs/simple-blog/v3-monolith/backend/docker-compose.hub.yml
curl -o .env https://raw.githubusercontent.com/usxs/simple-blog/v3-monolith/backend/.env.example
vim .env
docker compose -f docker-compose.hub.yml up -d
```

The compose file already sets `STORE=sqlite`, `DB_FILE` and a health check; V3 leaves `BACKEND_PUBLIC_URL` empty (same origin), V2 still points it at the API domain.

To upgrade just change `IMAGE_TAG` (or run `pull` then `up -d`); data lives in the volumes. The image covers amd64 / arm64; for other architectures build from `backend/` on the matching branch.


#### 2.1 Check Docker

```bash
docker --version          # 20.10+
docker compose version    # v2 — the command is `docker compose`, not `docker-compose`
```

If missing (Debian/Ubuntu):

```bash
curl -fsSL https://get.docker.com | sh
```

#### 2.2 Prepare data directories and fix permissions

The container runs as UID `1000`, so the host directories must be writable by that user — otherwise the first setup fails with "data directory is not writable":

```bash
cd backend
mkdir -p data article Musings img file
touch config.json         # must be a file, not a directory (Docker creates a directory for missing mount points)
sudo chown -R 1000:1000 data article Musings img file config.json
```

#### 2.3 Write environment variables

```bash
cp .env.example .env
vim .env
```

At minimum change these four:

```ini
ADMIN_USERNAME=admin
ADMIN_PASSWORD=use-your-own-strong-password   # used once to create the admin on first start
SITE_PUBLIC_URL=https://www.example.com       # frontend URL, used in sitemap and push links
BACKEND_PUBLIC_URL=https://api.example.com    # backend URL, used in robots.txt
```

Leave captcha secret, IndexNow, probe source and site-name seeds empty for now; they are covered later.

#### 2.4 Start it

```bash
docker compose up -d --build
docker compose ps           # should show Up (healthy)
docker compose logs --tail 50
```

> After changing code or `.env`, always rebuild with `--build`; restarting the container does not pick up new code.

#### 2.5 Verify the backend

```bash
curl -s http://127.0.0.1:33001/api/auth/status
# {"ok":true,"authed":false,"setupNeeded":false,"dataWritable":true}
```

`setupNeeded:false` means the admin was created from `.env`; `dataWritable:true` means the directory permissions are correct. If either is `false`, go back to step 2.2.

#### 2.6 Put the backend behind a domain (Nginx + HTTPS)

Reverse-proxy `api.example.com` to `127.0.0.1:33001`. Example (also works as a template in most control panels):

```nginx
server {
    listen 443 ssl http2;
    server_name api.example.com;

    ssl_certificate     /etc/letsencrypt/live/api.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;

    client_max_body_size 30m;          # image / attachment uploads

    location / {
        proxy_pass http://127.0.0.1:33001;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;   # required: the backend adds Secure to cookies based on it
        proxy_set_header X-Forwarded-Host  $host;     # WebAuthn rpId depends on it
    }
}
```

Certificates: `certbot --nginx -d api.example.com`.

#### 2.7 Log in to the admin

Open `https://api.example.com/admin` and sign in with the credentials from `.env`. Everything — posts, comments, images, section toggles — lives there. Right after the first login, change the password under "Settings → Admin account".

### 3. Deploy the frontend (Cloudflare Pages — V1 / V2 only)

> **V3 has no such step.** Its frontend lives in `backend/web/` and is served by the Node process, so the site is live once step 2 finishes. For the full V3 flow and `SITE_VERSION` and friends, see [Deploying V3 (monolith)](https://usxs.github.io/simple-blog/start/monolith/).

The frontend is plain static files; no build is required. Pick one of two ways:

#### Option A — Connect a Git repository (recommended; pushing publishes automatically)

1. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**, select your repository;
2. Build settings:

| Field | Value |
| --- | --- |
| Framework preset | None |
| Build command | leave empty |
| Build output directory | `frontend` |

3. Save and deploy — you get a `<random>.pages.dev` domain.

#### Option B — Upload from the CLI (no Git needed)

```bash
npm i -g wrangler
wrangler pages deploy frontend --project-name simple-blog
```

> The `functions/` directory must be uploaded together with the rest; `wrangler` compiles it into edge functions. Dragging plain HTML files uploads no Functions, so article pages would lose server-side rendering.

#### 3.1 Configure Pages environment variables

Pages project → **Settings → Environment variables** (add to both Production and Preview):

| Variable | Example | Purpose |
| --- | --- | --- |
| `SITE_URL` | `https://www.example.com` | Site URL used by canonical / OG / sitemap |
| `API_BASE_URL` | `https://api.example.com` | Backend URL used by Functions to fetch posts and the sitemap |
| `SITE_NAME` | `Simple Blog` | Site name (SSR page titles) |
| `SITE_BIO` | `Notes on tech and life.` | Site description (SSR descriptions) |

#### 3.2 Adjust the site's own information

- `frontend/app.js`, top-level `SITE_CONFIG`: site name, author, `apiBaseUrl` (point it at your backend), social links (empty hides them), site start date;
- `frontend/index.html`: `<title>`, `description`, `canonical`, OG tags and the domain in JSON-LD;
- `frontend/robots.txt`: the domain in the `Sitemap:` line.

Commit the changes; Pages redeploys automatically (Option B needs another `wrangler pages deploy`).

#### 3.3 Attach your own domain

Pages project → **Custom domains** → add `www.example.com` and create the CNAME at your DNS provider. Recommendations:

- Redirect the apex `example.com` to `www.example.com` (or the other way round) — don't serve both;
- If both frontend and backend sit behind Cloudflare, make sure no firewall rule blocks the API.

### 4. Post-deploy checklist

Walk through this list — all green means the deployment is fine:

| Check | Expected |
| --- | --- |
| Open `https://www.example.com/` | Home renders, sidebar "Node" shows ONLINE |
| Open any post `/post/<id>` | Full text; in the page source the `<title>` is the post title and `reader-content` contains the body (SSR works) |
| `https://www.example.com/sitemap.xml` | XML with real paths (no `#/`) |
| `https://api.example.com/admin` | You can log in |
| Upload an image in the admin | Returned Markdown points to `.webp`, image renders on the frontend |
| Submit a comment | "Pending moderation"; the admin moderation list shows it |
| Disable a section in "Settings → Sections" | It disappears from the frontend nav immediately; visiting its URL shows a "closed" page |

### 5. Submit to search engines

1. Add the site in Google Search Console — **prefer the "Domain" property** (DNS TXT verification) over "URL prefix", otherwise the sitemap host never matches and GSC keeps saying it cannot be read;
2. Bing Webmaster Tools can import the site from GSC directly;
3. Submit `https://www.example.com/sitemap.xml` in both;
4. For faster Bing indexing of new posts: open **Admin → Search engine push**, generate a key with `openssl rand -hex 16`, paste it and save. Use **Download key file** to get `<KEY>.txt`, deploy it at the `frontend/` root together with the site, then click **Check key file** to confirm. (`INDEXNOW_KEY` in the environment still works; the admin value wins.)

Detailed steps, certificates, backups and troubleshooting: [docs/DEPLOY.md](docs/DEPLOY.md).

## Environment variables

Backend (`backend/.env`):

| Variable | Required | Description |
| --- | --- | --- |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | one way or the other | Creates the admin on first start; otherwise set it up on the admin "setup" page |
| `SITE_PUBLIC_URL` | yes | Frontend URL used in the sitemap and push links |
| `BACKEND_PUBLIC_URL` | yes | Backend URL written into the `robots.txt` Sitemap line |
| `CAPTCHA_SECRET` | no | Generated automatically and persisted to `data/captcha-secret.json` when empty |
| `INDEXNOW_KEY` | no | Can also be set in the admin (takes precedence); when present, publish/delete pushes URLs to Bing and friends |
| `INDEXNOW_KEY_LOCATION` | no | Full URL of the key file; defaults to `${SITE_PUBLIC_URL}/<KEY>.txt` |
| `PROBE_ENABLED` | no | Enables frontend probe data; `0` disables (default enabled) |
| `PROBE_PROVIDER` | no | Probe type: `cf` (CF-Server-Monitor) or `minimal` (minimal monitor) |
| `PROBE_URL` | no | Probe panel base URL; the backend appends `/api/servers` (cf) or `/api/nodes` (minimal) |
| `PROBE_PANEL_URL` | no | Target of the "open monitor" button; hidden when empty |
| `SITE_NAME` / `SITE_AVATAR` / `SITE_TITLE` / `SITE_SUBTITLE` | no | Initial site info; editable in "Settings" afterwards, applies immediately |
| `WEBAUTHN_RP_ID` / `WEBAUTHN_ORIGIN` | no | Passkey RP ID and origin; derived from `X-Forwarded-Host` by default |
| `HOST_PORT` | no | Host port, default `33001` |
| `ADMIN_PATH` | no | Initial dashboard path, default `admin`; can be changed later in the dashboard |
| `AUTH_DATA_DIR` | no | Overrides the directory holding sessions, credentials, links and notification config (mainly for tests) |
| `STORE` | no | Storage implementation: `sqlite` (default on V2/V3) or `file` (V1 behaviour); the V1 branch only has file storage |
| `DB_FILE` | no | SQLite file path, default `data/blog.db` |
| `SITE_VERSION` / `SITE_BRANCH` / `SITE_COMMIT` | no | Build info shown by `/version` and the dashboard on V3, usually injected by compose |

## API reference

Public (no login):

```
GET  /api/sync?module=posts            # post list (anonymous: summaries + ETag; logged in: full text)
GET  /api/search?q=<query>[&limit=20]  # search (Chinese substring / English subsequence, returns snippets)
GET  /api/comments?postId=<id>         # approved comments
GET  /api/public/post/<id>             # single post (used by Pages Functions SSR)
GET  /api/site                         # site info (name/avatar/title/subtitle/sections/paths/order)
GET  /version                          # (Pages) current deployment short version
GET  /api/deploy-version               # backend proxy of /version (60s cache) for the admin badge
GET  /api/probe-servers                # probe nodes (source chosen in the admin "Probe" page)
GET  /api/captcha                      # captcha question and signature
POST /api/comments/submit              # submit a comment (captcha + honeypot)
GET  /sitemap.xml  GET /robots.txt     # SEO
```

Authenticated (cookie session):

```
GET  /api/auth/status                  # login state / whether setup is needed
POST /api/auth/setup | login | logout | change-password
POST /api/auth/passkey/login-options | passkey/login   # passwordless login (public)
GET  /api/sync?module=comments         # includes pending comments
POST /api/save    POST /api/delete     # create/update/delete content
POST /api/upload                       # image/attachment upload (images become WebP)
GET  /api/admin/overview               # settings summary (site/2FA/passkeys/sessions)
POST /api/admin/site                   # save site info
POST /api/auth/change-username         # change admin username
POST /api/auth/totp/setup | enable | disable | backup-codes
GET  /api/auth/passkeys                # passkey list
POST /api/auth/passkey/register-options | register | delete
GET  /api/auth/sessions                # active sessions
POST /api/auth/sessions/revoke-others  # sign out other devices
```

Full parameters: [docs/API.md](docs/API.md).

## Security notes

- Passwords are hashed with salted `scrypt` (N=16384, r=8, p=1) and compared in constant time; usernames are handled the same way to avoid enumeration.
- Session tokens live only in a cookie; the server stores just their SHA-256. The cookie is `HttpOnly` + `SameSite=Strict` and gets `Secure` under HTTPS. Sliding 7 days, absolute cap 30 days.
- Login is rate-limited per IP: 5 failures in 15 minutes lock the IP for 15 minutes; failures always say "invalid username or password".
- Every write checks `Origin` / `Sec-Fetch-Site`; cross-site writes are rejected with 403.
- Uploaded filenames are sanitized (path separators and control characters removed); images are converted server-side and the original is never written.
- 2FA is standard TOTP (HMAC-SHA1, 30-second step, ±1 window); backup codes are stored as SHA-256 and invalidated on use.
- Passkeys use WebAuthn: the server keeps only public keys and signature counters; challenge, origin, rpIdHash and counter rollback are verified.
- Changing the password, disabling 2FA, deleting a passkey and renaming the admin all require the current password.

> Always serve over HTTPS. On plain HTTP the `Secure` cookie flag is dropped and passwords travel in clear text.

## Notes

> **Bump the asset version when you change CSS/JS**: `frontend/index.html` references
> `style.css`, `markdown.js` and `app.js` with a `?v=` query string. Cloudflare caches
> static assets at the edge for up to 4 hours, so after editing those files change
> `?v=20261122-1` to a new value, otherwise browsers may keep using the old copy.


1. **Rebuild after code changes**: `docker compose up -d --build`. Data lives on the host, so rebuilding loses nothing.
2. **Directory permissions**: the container runs as UID 1000, so `data/`, `article/`, `img/` … must be writable by `1000:1000`, otherwise the first setup fails with "data directory not writable".
3. **`config.json` is a file mount**: if the host file is missing, Docker mounts a **directory** with that name and the backend cannot read its config. Make sure `backend/config.json` exists before the first start (the repo ships an empty template).
4. **Image formats**: `.jpg/.jpeg/.png/.gif` become WebP; SVG and AVIF stay as-is; existing `.webp` is never re-encoded. If the converted file would be larger, the original is kept. Set `IMAGE_WEBP_DISABLE=1` to disable conversion.
5. **Old images are not converted**: old posts reference the filenames of their time, and re-converting would break links, so only later uploads are converted.
6. **Site name / domain appear in several places**: name, avatar text, browser title and subtitle can be changed in "Settings" (the frontend reads `/api/site`; SSR reads it too) without redeploying. Static meta in `index.html`, `functions/` env vars and the domain in `robots.txt` still need manual updates (for search engines and no-JS clients).
7. **Section toggle / rename / path / icon / order** all live in "Settings → Sections" and apply immediately without redeploying. Disabled sections disappear from the frontend sidebar, the mobile dock and the admin sidebar (re-enable them in the same page). The home section can be renamed and re-iconed but not disabled.
   - Paths accept letters, digits and hyphens only (1–24 chars) and may not collide with reserved paths such as `post`, `api`, `admin`; two sections cannot share a path
   - After a path change the old URL still works (302 to the new one), but `sitemap`, nav links and SSR metadata follow the new path
   - Uploaded icons live in `img/<date>/` — include them in backups
   - Drag the ⋮⋮ handle to reorder; the frontend sidebar, mobile dock and admin sidebar all follow
   - Footer: filing numbers only render as icon badges (hover = number, click = official query page); `© year name · All Rights Reserved.` is toggled by "Show copyright line" and never displayed in the admin preview
8. **Site config is cached in the browser**: the frontend stores the last `/api/site` (section toggles / names / paths / order) in `localStorage` under `sp_site_cache_v1`, so the first paint already matches it — hidden sections never flash — and the site still renders when the backend is unreachable or slow. New values are fetched on the next visit and replace the cache (the backend uses `updatedAt` to detect changes). If a change doesn't show up, hard-refresh (`Cmd/Ctrl + Shift + R`) or clear that key.
9. **First paint never waits for the backend**: home, lists and posts render from cached data / SSR content first; node status, probe data and backend config refresh asynchronously. A slow or dead backend never blanks the page — the node badge just shows OFFLINE.
10. **SEO and domains**: `canonical` uses `SITE_URL`. If both `example.com` and `www.example.com` answer, pick one and 301 the other, otherwise you get duplicate content.
11. **Backups**: on V1 back up `config.json`, `article/`, `Musings/`, `img/`, `file/` and `data/` under `backend/`; on V2/V3 `data/` (including `blog.db` and its WAL sidecars), `img/` and `file/` are enough. `tar` them and keep a copy elsewhere.
12. **2FA backup codes**: the 10 codes shown when enabling 2FA are displayed once — save them. Lost authenticator and no codes? Delete the `totp` field in `backend/data/auth.json` on the server and restart (2FA turns off).
13. **Passkeys require HTTPS**: browsers do not expose the Passkey API over `http://` or a bare IP. The backend derives `rpId` from `X-Forwarded-Host`; if the proxy domain and backend domain differ, set `WEBAUTHN_RP_ID` / `WEBAUTHN_ORIGIN` explicitly. Keys are bound to the domain — changing domains means registering again.
14. **Diagrams depend on a CDN**: ```` ```mermaid ```` blocks are rendered in the browser by lazily importing `mermaid@11` from jsDelivr — not bundled. Offline/intranet setups don't break; the block stays as source text. To change the CDN, edit the `import()` URL in `loadMermaid()` in `frontend/app.js` (V3: `backend/web/app.js`) and `backend/admin.js`.
15. **Comment anti-spam**: two comments from the same IP must be at least 30 seconds apart, at most 8 per hour and 30 per day; the captcha issues at most 30 challenges per 10 minutes. Limits return `429` with `Retry-After`, and the submit button shows a countdown. To relax for real visitors, change `CAPTCHA_MAX` in `backend/captcha.js` and the interval/count constants in `backend/server.js`.
17. **Syncing moments to Telegram**: enable it in **Manage → Moment sync** and fill in two fields — the `Bot Token` from [@BotFather](https://t.me/BotFather) (`123456789:AA…`) and the channel id (`@your_channel` or a `-100…` number). The bot must be in the channel with permission to post, otherwise the API answers *not enough rights*. Images inside a moment are uploaded too; their URLs are built from **Site URL**, so it must be reachable from the internet. Editing deletes the old message and posts a new one; deleting removes it from the channel. Config lives in `backend/data/telegram.json` (0600), message ids in `telegram-map.json`.

16. **Post ordering**: both the admin list and the frontend order by publish date (`date`) descending, then modification time. To reorder, edit the `date` inside the post.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| Admin returns 502 | The container is not running: `docker compose ps` / `docker compose logs --tail 100` |
| Setup says "data directory not writable" | Wrong ownership: `sudo chown -R 1000:1000 data article Musings img file` |
| `Conflict. The container name "..." is already in use` | A container with that name exists from another compose project: `docker rm -f simple-blog-backend` then `up -d` again |
| Frontend loads but posts 404 / empty list | Wrong `API_BASE_URL`, or CORS blocked; check `/api/sync` in the browser console |
| Uploaded images stay jpg | `sharp` failed to build (look for a warn in `docker compose logs`) — rebuild; or `IMAGE_WEBP_DISABLE=1` is set |
| sitemap shows the home page | Pages Functions not deployed (the directory must be named `functions/`), or `_redirects` points to the wrong domain |
| Section changes don't show up | The frontend uses the cached site config: hard-refresh (`Cmd/Ctrl + Shift + R`) or run `localStorage.removeItem('sp_site_cache_v1')` and reload |
| Blank line above the first sidebar item | Layout bug in older builds (empty `<li>` left behind after reordering); update `frontend/app.js` and `frontend/style.css` (V3: `backend/web/`) |
| V2/V3 reports "data directory not writable" | `data/` (including `blog.db`) must be owned by `1000:1000`: `sudo chown -R 1000:1000 data img file` |
| Comment submission says the post does not exist | Older builds checked `article/<id>` on disk; upgrade to a build with `storage.postExists` |
| V3 home page returns `{"code":200,...}` JSON | That is the V1/V2 backend; V3 needs `backend/web/` and the monolith routes in server.js |

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE)
