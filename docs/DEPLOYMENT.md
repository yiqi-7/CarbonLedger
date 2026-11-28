# CarbonLedger 部署说明

当前部署策略是 Linux 直接安装服务，不使用 Docker Compose。本文中的命令以 `/opt/carbon-ledger` 为应用目录、`arcnum.cn` 为示例域名；请按实际主机调整路径和域名。

部署脚本只负责拉取并构建应用、同步 Prisma 结构、重启 API、执行就绪检查。它不会自动创建数据库备份，也不会在失败时假装完成回滚。数据库备份、恢复和代码回滚都必须由运维人员按本文明确执行并验证。

## 服务器初始化（一次性）

```bash
sudo apt-get update
sudo apt-get install -y nginx postgresql certbot python3-certbot-nginx gnupg curl
sudo apt-get install -y fonts-noto-cjk
```

`fonts-noto-cjk` 是 PDF 报告显示中文所必需的；缺失时 PDF 会回退到内置字体，中文可能显示异常。生产机应使用 Node.js 22、PostgreSQL 18（或经过验证的兼容版本），并让 API 只监听本机地址。

创建一个专用、无登录权限的应用账号，并确保发布账号能读取应用目录、执行 `sudo systemctl restart carbon-ledger`。如果现有主机已经使用 `ubuntu` 运行服务，先完成迁移和权限验证再更换账号。

## 发布前准备

1. 在本地完成测试和构建：

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

3. 创建生产环境变量文件 `/opt/carbon-ledger/server/.env`，不要提交到仓库：

```bash
cat > /opt/carbon-ledger/server/.env <<'EOF'
DATABASE_URL=postgresql://carbonledger:数据库密码@127.0.0.1:5432/carbonledger?schema=public
JWT_SECRET=随机长密钥
# 同源 Nginx 部署无需设置；只有独立前端域名时才填写可信来源
CORS_ORIGINS=
# 仅在反向代理确实可信时设置；可填 1、true 或 false
TRUST_PROXY=1
# 认证接口限流和请求超时，可按代理/业务流量调整
AUTH_LOGIN_RATE_LIMIT=30
AUTH_REGISTER_RATE_LIMIT=20
AUTH_RATE_WINDOW_MS=900000
AUTH_REGISTER_RATE_WINDOW_MS=3600000
REQUEST_TIMEOUT_MS=30000
ADMIN_USERNAME=admin
ADMIN_PASSWORD=独立管理员密码
PORT=3000
HOST=127.0.0.1
EOF
chmod 600 /opt/carbon-ledger/server/.env
```

4. 创建 PostgreSQL 数据库和最小权限账号，不要让应用使用 PostgreSQL 管理员账号：

```bash
sudo -u postgres createuser --pwprompt carbonledger
sudo -u postgres createdb -O carbonledger carbonledger
```

## 固定提交发布门禁

部署目标必须是经过 Git 校验的固定 commit SHA。脚本支持两种安全用法：

- 日常发布可以直接运行 `bash scripts/deploy.sh`。脚本先 `git fetch --all --prune`，再把 `origin/main` 解析为完整 40 位 SHA，并始终部署这个固定提交，而不是把一个移动中的分支直接交给 `git reset`。
- CI、审核发布和回滚应显式传入已审核的完整 SHA。脚本会拒绝短 SHA、分支名、标签名和无法由 Git 验证的对象：

```bash
cd /opt/carbon-ledger
TARGET_SHA=0123456789abcdef0123456789abcdef01234567 bash scripts/deploy.sh
# 或：bash scripts/deploy.sh 0123456789abcdef0123456789abcdef01234567
```

发布前从远端记录目标 SHA，并在变更审核中保留它：

```bash
git fetch origin main
git rev-parse origin/main
# 将输出的完整 SHA 作为 TARGET_SHA 传给部署脚本
```

脚本会拒绝工作树中的未提交改动，并在检出后再次确认 `HEAD` 与已验证 SHA 相同。脚本会从跟踪的 SQLite schema 生成临时 `server/prisma/schema.production.prisma`，仅用于 Prisma 生成与数据库同步，退出时删除；跟踪文件不会被改写。

不要在生产机用未审核的 `git pull`、`git reset --hard origin/main` 替代部署脚本。分支可能在命令执行期间移动，而显式 SHA 能让发布记录和回滚目标可复核。

## 发布前备份（手动且必须验证）

数据库备份不是部署脚本的隐含步骤。生产发布前先完成一次加密逻辑备份，确认文件存在且非空，再继续部署。仓库已有的 `scripts/backup-postgres.sh` 会创建 GPG 加密的 PostgreSQL custom dump，并保留最近 4 份；它不会验证你是否能恢复成功，因此仍需定期演练恢复。

首次配置备份目录、配置文件和备份专用 GPG 公钥：

```bash
sudo install -d -m 700 /var/backups/carbon-ledger
sudo install -m 600 /dev/null /etc/carbon-ledger-backup.env
sudoedit /etc/carbon-ledger-backup.env
# 至少填写：
# DATABASE_URL=...
# BACKUP_GPG_RECIPIENT=备份专用 GPG 指纹或邮箱
# GPG_PUBLIC_KEY_FILE=/etc/carbonledger-backup-pub.asc  # 可选的 ASCII armor 公钥
```

手动执行并检查结果：

```bash
sudo bash -lc 'set -a; source /etc/carbon-ledger-backup.env; set +a; BACKUP_DIR=/var/backups/carbon-ledger bash /opt/carbon-ledger/scripts/backup-postgres.sh'
sudo find /var/backups/carbon-ledger -maxdepth 1 -type f -name 'carbonledger-*.dump.gz.gpg' -printf '%TY-%Tm-%Td %TH:%TM %p %s bytes\n' | sort
```

备份脚本成功只表示 dump 已生成并加密。恢复演练必须在临时数据库中进行，不能覆盖线上库：

```bash
gpg --decrypt carbonledger-YYYYmmddTHHMMSSZ.dump.gz.gpg | gzip -d > /tmp/carbonledger.dump
createdb carbonledger_restore
pg_restore --exit-on-error --dbname=carbonledger_restore /tmp/carbonledger.dump
pg_restore --list /tmp/carbonledger.dump | head
```

备份命令失败、文件为空、GPG 公钥不匹配或最近一次恢复演练未通过时，停止发布并先修复备份链路。部署脚本不会替你判断这些条件。

## 执行发布

确认备份已经完成后：

```bash
cd /opt/carbon-ledger
bash scripts/deploy.sh
```

显式 SHA 发布：

```bash
cd /opt/carbon-ledger
TARGET_SHA=<已审核的完整 40 位 SHA> bash scripts/deploy.sh
```

脚本会执行 `npm ci`、生成生产 Prisma Client、执行 `prisma db push`、构建前端和 API，然后重启 `carbon-ledger`。`prisma db push` 可能改变数据库结构，因此发布前备份和兼容性检查不可省略。

## 就绪检查

API 提供两个健康接口：`GET /api/health` 是 liveness，只表示进程已启动；`GET /api/health/ready` 是 readiness，会以有界数据库探针确认应用依赖可用。readiness 成功时返回 HTTP 200 和 `{"status":"ok",...}`，失败时返回 HTTP 503。部署脚本检查 systemd 服务处于 active，并检查 readiness 返回的 JSON `status` 为 `ok`；只检查 `systemctl is-active` 不足以证明 API 已经可以接收请求。

应用默认对登录和注册接口按客户端 IP 做进程内固定窗口限流，并对未完成请求设置 30 秒超时。多实例部署应在 Nginx 或网关层配置共享限流；如果启用 `TRUST_PROXY`，只能填写实际可信代理拓扑，否则客户端 IP 可能被伪造。API 还返回 `X-Content-Type-Options`、`X-Frame-Options`、`Referrer-Policy`、`Permissions-Policy` 和 API-safe CSP；HTTPS 请求会返回 HSTS。

默认检查地址是 `http://127.0.0.1:3000/api/health/ready`，如果 Nginx 或其他环境提供等价 HTTPS 地址，可以覆盖：

```bash
READINESS_URL=https://127.0.0.1/api/health/ready TARGET_SHA=<完整 SHA> bash scripts/deploy.sh
```

不要把仅表示进程存活的 `/api/health` 当作生产发布的 readiness 检查。

## Nginx：HTTPS、代理和安全响应头

API 应只监听 `127.0.0.1:3000`，公网流量经 Nginx 进入。先使用 HTTP 完成证书申请，再把站点配置为 HTTP 重定向到 HTTPS。证书路径由 Certbot 创建，示例配置如下：

```nginx
# /etc/nginx/sites-available/arcnum.cn
server {
    listen 80;
    listen [::]:80;
    server_name arcnum.cn www.arcnum.cn;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name arcnum.cn www.arcnum.cn;

    root /opt/carbon-ledger/web/dist;
    index index.html;
    server_tokens off;

    ssl_certificate /etc/letsencrypt/live/arcnum.cn/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/arcnum.cn/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;
    ssl_session_tickets off;

    # 这些头在成功响应和错误响应上都发送。
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

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

`Strict-Transport-Security` 会让浏览器在有效期内强制使用 HTTPS。确认所有子域名都支持 HTTPS 后，才考虑加入 `includeSubDomains`；启用 HSTS 后撤回需要等待浏览器缓存过期。若应用后续使用摄像头、麦克风或跨域嵌入，再按实际功能收紧或调整 `Permissions-Policy`、`X-Frame-Options`，不要为了消除检查而放宽为 `*`。

启用配置并申请证书：

```bash
sudo mkdir -p /var/www/certbot
sudo ln -s /etc/nginx/sites-available/arcnum.cn /etc/nginx/sites-enabled/arcnum.cn
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d arcnum.cn -d www.arcnum.cn
sudo certbot renew --dry-run
```

证书申请前，域名必须已经解析到服务器，且 80 端口能从公网访问。修改 Nginx 后始终先执行 `nginx -t`，通过后再 reload。公网验收至少检查：

```bash
curl -fsSIL https://arcnum.cn/
curl -fsS https://arcnum.cn/api/health
```

## systemd 服务和硬化建议

创建 `/etc/systemd/system/carbon-ledger.service`：

```ini
[Unit]
Description=CarbonLedger API
After=network-online.target postgresql.service
Wants=network-online.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/carbon-ledger/server
EnvironmentFile=/opt/carbon-ledger/server/.env
ExecStart=/usr/bin/node /opt/carbon-ledger/server/dist/main.js
Restart=on-failure
RestartSec=5
TimeoutStopSec=30
UMask=027

[Install]
WantedBy=multi-user.target
```

启用并检查：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now carbon-ledger
sudo systemctl status carbon-ledger
curl -fsS http://127.0.0.1:3000/api/health
```

在确认应用不需要写入应用目录、设备或其他系统路径后，可以通过 `sudo systemctl edit carbon-ledger` 增加以下硬化项。`ReadWritePaths` 只列出应用确实需要写入的目录；先在预生产机验证，避免阻断 Node、字体或临时文件访问：

```ini
[Service]
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=strict
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
PrivateDevices=true
RestrictSUIDSGID=true
RestrictNamespaces=true
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
LockPersonality=true
SystemCallArchitectures=native
ReadWritePaths=/opt/carbon-ledger/server
```

长期运行建议使用专用无登录服务账号，并将 `.env` 设为 `0600`、归该账号读取；使用 `CapabilityBoundingSet=` 和 `AmbientCapabilities=` 清空不需要的 Linux capability。每次硬化后执行 `systemctl daemon-reload`、重启服务，并通过本机就绪接口、登录和 PDF 生成等实际功能验收。硬化配置不是部署脚本自动写入的内容。

## 失败处理和回滚

就绪检查失败时，脚本会保留日志和当前检出的目标提交，打印上一版本 SHA，并明确停止；它不会自动回滚。先查看原因：

```bash
sudo journalctl -u carbon-ledger -n 200 --no-pager
sudo systemctl status carbon-ledger --no-pager --full
curl -v http://127.0.0.1:3000/api/health
```

如果数据库结构与旧版本兼容，且已确认一个已审核的旧提交，可以按同样的固定 SHA 方式回滚代码：

```bash
cd /opt/carbon-ledger
git fetch --all --prune
TARGET_SHA=<已验证的旧版本完整 SHA> bash scripts/deploy.sh
```

代码回滚不会自动撤销 `prisma db push` 已做的数据库变更。若新版本已经改变或删除数据结构，必须先停机进入维护窗口，在临时数据库验证备份恢复，再依据经过演练的数据库恢复方案处理线上库；不要直接执行未经验证的 `DROP`、手工逆向 SQL 或覆盖线上数据库。回滚完成后重新检查 `/api/health`、HTTPS 响应头和关键业务流程。

## 每次发布检查清单

- [ ] 发布目标是已审核的完整 40 位 SHA，或脚本已把 `origin/main` 解析并校验为固定 SHA
- [ ] 工作树没有未提交改动，生产 `.env` 权限为 `0600`
- [ ] 发布前加密 PostgreSQL 备份已成功生成、非空且位置已记录
- [ ] 最近一次恢复演练仍然有效，或本次发布已在临时数据库验证
- [ ] PostgreSQL 使用最小权限账号，JWT 密钥和管理员密码不是示例值
- [ ] `prisma db push` 的结构变化已审核
- [ ] API systemd 服务正常，且本机就绪接口返回 `status: ok`
- [ ] Nginx 配置通过 `nginx -t`
- [ ] HTTP 自动跳转 HTTPS，证书续期 dry-run 通过
- [ ] HTTPS 响应包含 HSTS、`X-Content-Type-Options`、`X-Frame-Options` 等安全头
- [ ] `https://arcnum.cn/api/health` 返回 HTTP 200 和 `status: ok`
- [ ] 登录、注册审批、项目创建、记录核算、版本报告完成线上冒烟测试
- [ ] 已记录当前版本 SHA、备份文件名和部署时间
