# 备份与升级

## 备份

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
