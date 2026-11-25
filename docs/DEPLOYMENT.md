# CarbonLedger 部署说明

当前部署策略：Linux 直接安装服务，不使用 Docker Compose。

## 当前服务器

- 域名：`arcnum.cn`
- 服务器：由运维环境变量或主机面板提供，本文不保存公网 IP
- 系统：Ubuntu 26.04 LTS
- 已安装：Node.js 22、PostgreSQL 18、Nginx、Certbot
- 当前状态：基础软件已安装，应用代码尚未上传，线上数据库尚未创建

## 服务器初始化（一次性）

```bash
sudo apt-get update
sudo apt-get install -y nginx postgresql certbot python3-certbot-nginx gnupg
sudo apt-get install -y fonts-noto-cjk
```

`fonts-noto-cjk` 是 PDF 报告显示中文所必需的；缺失时 PDF 会回退到内置字体，中文可能显示异常。

## 发布前准备

1. 在本地运行完整测试和构建：

```bash
npm install
npm run build:shared
npm test
npm run build -w server
npm run build -w web
```

2. 服务器创建应用目录并上传代码：

```bash
sudo mkdir -p /opt/carbon-ledger
sudo chown -R ubuntu:ubuntu /opt/carbon-ledger
cd /opt/carbon-ledger
git clone https://github.com/yiqi-7/CarbonLedger.git .
```

3. 创建生产环境变量文件 `/opt/carbon-ledger/server/.env`（不要提交到仓库）：

```bash
cat > /opt/carbon-ledger/server/.env <<'EOF'
DATABASE_URL=postgresql://carbonledger:数据库密码@127.0.0.1:5432/carbonledger?schema=public
JWT_SECRET=随机长密钥
# 同源 Nginx 部署无需设置；只有独立前端域名时才填写可信来源
CORS_ORIGINS=
ADMIN_USERNAME=admin
ADMIN_PASSWORD=独立管理员密码
PORT=3000
HOST=127.0.0.1
EOF
chmod 600 /opt/carbon-ledger/server/.env
```

4. 创建 PostgreSQL 数据库和最小权限账号（不要用管理员账号运行应用）：

```bash
sudo -u postgres createuser --pwprompt carbonledger
sudo -u postgres createdb -O carbonledger carbonledger
```

5. 日常发布使用一键脚本。脚本会先拒绝存在未提交改动的工作树，再记录当前/目标 commit，生成临时 PostgreSQL Prisma schema（退出时删除），同步结构、构建并重启服务；仓库中的 SQLite schema 不会被改写：

```bash
cd /opt/carbon-ledger
bash scripts/deploy.sh
```

> 注意：脚本从跟踪的 SQLite schema 生成临时 `server/prisma/schema.production.prisma`，仅用于 Prisma 生成与数据库同步，脚本退出时删除；跟踪文件不会被改写。

API 默认关闭 CORS；本部署通过 Nginx 同源提供前端与 `/api`，无需额外跨域配置。若独立前端域名确有需要，在 `.env` 中将 `CORS_ORIGINS` 设为逗号分隔的精确来源（含协议和端口），不要使用 `*`；认证使用 Bearer token，不依赖跨站 Cookie。

## Nginx

创建 `/etc/nginx/sites-available/arcnum.cn`：

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name arcnum.cn www.arcnum.cn;

    root /opt/carbon-ledger/web/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 20m;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

启用并检查：

```bash
sudo ln -s /etc/nginx/sites-available/arcnum.cn /etc/nginx/sites-enabled/arcnum.cn
sudo nginx -t
sudo systemctl reload nginx
```

## Node 服务

使用 systemd 管理 API，创建 `/etc/systemd/system/carbon-ledger.service`：

```ini
[Unit]
Description=CarbonLedger API
After=network.target postgresql.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/carbon-ledger/server
EnvironmentFile=/opt/carbon-ledger/server/.env
ExecStart=/usr/bin/node /opt/carbon-ledger/server/dist/main.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

启用：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now carbon-ledger
sudo systemctl status carbon-ledger
curl http://127.0.0.1:3000/api/health
```

## HTTPS

确认 DNS 和 HTTP 站点可访问后再申请证书：

```bash
sudo certbot --nginx -d arcnum.cn -d www.arcnum.cn
sudo certbot renew --dry-run
```

证书申请前不要执行 HTTPS 配置；域名必须已经解析到服务器，且 80 端口可从公网访问。

## 备份与恢复

生产环境使用 PostgreSQL 的加密逻辑备份，保留最近 4 份。先在服务器导入备份专用 GPG 公钥，并将其指纹写入 root 仅可读的环境文件：

```bash
sudo install -d -m 700 /var/backups/carbon-ledger
sudo install -m 600 /dev/null /etc/carbon-ledger-backup.env
sudoedit /etc/carbon-ledger-backup.env
# 内容：
#   DATABASE_URL=...            （可直接使用应用 .env 中的连接串，脚本会去掉 ?schema= 参数）
#   BACKUP_GPG_RECIPIENT=GPG指纹或邮箱
#   GPG_PUBLIC_KEY_FILE=/etc/carbonledger-backup-pub.asc   （脚本启动时导入该公钥）
```

`GPG_PUBLIC_KEY_FILE` 指向备份专用公钥（ASCII armor 导出文件）。脚本会在加密前导入它，因此公钥无需事先导入运行用户的 GPG keyring。若该变量留空，则要求运行用户 keyring 中已存在对应公钥。

手动验证备份：

```bash
sudo bash -lc 'set -a; source /etc/carbon-ledger-backup.env; set +a; BACKUP_DIR=/var/backups/carbon-ledger bash /opt/carbon-ledger/scripts/backup-postgres.sh'
```

创建 `/etc/systemd/system/carbon-ledger-backup.service`：

```ini
[Unit]
Description=CarbonLedger encrypted PostgreSQL backup

[Service]
Type=oneshot
EnvironmentFile=/etc/carbon-ledger-backup.env
ExecStart=/opt/carbon-ledger/scripts/backup-postgres.sh
```

创建 `/etc/systemd/system/carbon-ledger-backup.timer`：

```ini
[Unit]
Description=Weekly CarbonLedger backup

[Timer]
OnCalendar=Sun 03:15
Persistent=true

[Install]
WantedBy=timers.target
```

启用并检查：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now carbon-ledger-backup.timer
sudo systemctl start carbon-ledger-backup.service
sudo systemctl list-timers carbon-ledger-backup.timer
```

恢复演练需在临时数据库执行，不能覆盖线上库：

```bash
gpg --decrypt carbonledger-YYYYmmddTHHMMSSZ.dump.gz.gpg | gzip -d > /tmp/carbonledger.dump
createdb carbonledger_restore
pg_restore --exit-on-error --dbname=carbonledger_restore /tmp/carbonledger.dump
```

## 发布检查清单

- [ ] `arcnum.cn` A 记录指向服务器公网 IP（IP 不写入仓库）
- [ ] PostgreSQL 数据库和最小权限账号已创建
- [ ] Prisma provider 已切换为 `postgresql`
- [ ] 生产 `.env` 已使用随机 JWT 密钥和新管理员密码
- [ ] API systemd 服务正常
- [ ] Nginx 配置检查通过
- [ ] `http://arcnum.cn/api/health` 返回 `status: ok`
- [ ] Certbot 证书申请成功
- [ ] `https://arcnum.cn/api/health` 返回 `status: ok`
- [ ] 登录、注册审批、项目创建、记录核算、版本报告完成线上冒烟测试
