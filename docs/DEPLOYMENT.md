# CarbonLedger 部署说明

当前部署策略：Linux 直接安装服务，不使用 Docker Compose。

## 当前服务器

- 域名：`arcnum.cn`
- 服务器：`111.229.48.14`
- 系统：Ubuntu 26.04 LTS
- 已安装：Node.js 22、PostgreSQL 18、Nginx、Certbot
- 当前状态：基础软件已安装，应用代码尚未上传，线上数据库尚未创建

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
npm ci
npm run build:shared
npm run build -w server
npm run build -w web
```

3. 创建 PostgreSQL 数据库和账号。不要使用管理员账号运行应用：

```bash
sudo -u postgres createuser --pwprompt carbonledger
sudo -u postgres createdb -O carbonledger carbonledger
```

4. 部署前把 `server/prisma/schema.prisma` 的 datasource provider 从 `sqlite` 改为 `postgresql`，然后生成客户端并同步结构：

```bash
cd /opt/carbon-ledger
npx prisma generate --schema server/prisma/schema.prisma
npx prisma db push --schema server/prisma/schema.prisma
```

生产环境必须设置独立随机的 `JWT_SECRET`、数据库密码、管理员密码，不要复用本地 `.env`。

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

## 发布检查清单

- [ ] `arcnum.cn` A 记录指向 `111.229.48.14`
- [ ] PostgreSQL 数据库和最小权限账号已创建
- [ ] Prisma provider 已切换为 `postgresql`
- [ ] 生产 `.env` 已使用随机 JWT 密钥和新管理员密码
- [ ] API systemd 服务正常
- [ ] Nginx 配置检查通过
- [ ] `http://arcnum.cn/api/health` 返回 `status: ok`
- [ ] Certbot 证书申请成功
- [ ] `https://arcnum.cn/api/health` 返回 `status: ok`
- [ ] 登录、注册审批、项目创建、记录核算、版本报告完成线上冒烟测试
