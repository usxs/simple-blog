# 备份与升级

## 后台一键备份

后台「管理 → 备份」→「立即备份并下载」：把整个 `backend/`（代码 + 文章 + 图片 + 文件 + `data/`，不含 `node_modules`）打包成 `<BACKUP_PREFIX><时间>-fe<前端版本>.tar.gz`（前缀默认 `backup-`）并自动下载，同时留在服务器上，可再次下载或删除。

包里带 `manifest.json`（含前端版本 / 分支 / commit）、`frontend/`（源码或静态快照）、`restore.sh`、`MIGRATION.md`、`docker-compose.yml` 与 `.env.example`。

```bash
docker run --rm -v "$PWD":/w -w /w alpine tar xzf backup-*.tar.gz
cd backup-*/
./restore.sh --prepare-only    # 体检 docker / compose / 磁盘 / 端口
sudo ./restore.sh              # 恢复并重建容器（可加 TARGET_DIR=... PORT=...）
```

- `BACKUP_DIR`（默认 `data/backups`）：备份包目录
- `BACKUP_KEEP`（默认 `10`）：保留份数，超出删旧的

## 自动备份与 WebDAV

同一张卡片里：

- **自动备份**：打开并设好时间（服务器本地时区，`HH:MM`）后，后端定时器每天自己打包一次，不依赖浏览器；失败原因写在设置行的「上次自动备份」状态里
- **WebDAV**：填地址 / 账号 / 密码 / 目录，点「测试连接」确认目录可写；开了「自动上传」后每次自动备份成功就推一份到网盘，也可以手动对某一份点上传
- 配置存 `data/backup-settings.json`（0600），WebDAV 密码不会回显给前端
- 换服务器时把 `data/backup-settings.json` 一起带走，自动备份与 WebDAV 设置就还在

## 手工备份

只需要 `backend/` 下的六个位置：

```bash
cd /path/to/backend
tar -czf backup-$(date +%F).tar.gz \
  config.json article Musings img file data
```

- 数据量小（纯文本为主），完整打包最省事
- 图片多的话可以只备份 `article`、`Musings`、`data`、`config.json`，图片另存
- 想自动化就加一条 cron：

```bash
0 4 * * * cd /path/to/backend && tar -czf /root/backup-$(date +\%F).tar.gz config.json article Musings data img file && find /root -name 'backup-*.tar.gz' -mtime +14 -delete
```

## 恢复

```bash
docker compose down
tar -xzf backup-2026-11-23.tar.gz -C /path/to/backend
sudo chown -R 1000:1000 config.json article Musings img file data
docker compose up -d
```

## 升级（镜像方式）

```bash
# 改 .env 里的 IMAGE_TAG，或直接拉 latest
docker compose -f docker-compose.hub.yml pull
docker compose -f docker-compose.hub.yml up -d
docker compose -f docker-compose.hub.yml ps      # 等 healthy
```

## 升级（源码方式）

```bash
cd /path/to/backend
cp -a . ../backend-backup-$(date +%F)   # 先留一份
docker compose up -d --build
```

!!! warning "务必带 `--build`"
    `up -d` 不会重建镜像，改了代码也不会生效。

## 回滚

- 镜像方式：把 `IMAGE_TAG` 改回旧版本，`pull && up -d`
- 源码方式：`git checkout <上一个 commit>` 后 `up -d --build`，或直接从备份目录恢复

## 前端发布

前端在 Cloudflare Pages 上，每次部署都有独立 ID，可以在 Dashboard 的 **Deployments** 里一键回滚到上一个版本；`git revert` 后推送也会触发重新发布。

## 下一步

[常见问题 :material-arrow-right:](faq.md){ .md-button .md-button--primary }
