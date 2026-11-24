#!/usr/bin/env bash
# CarbonLedger 服务器端部署脚本（在服务器上执行）
# 用法：sudo -u ubuntu bash scripts/deploy.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/carbon-ledger}"
BRANCH="${BRANCH:-main}"

cd "$APP_DIR"

echo "==> 1/7 拉取代码 ($BRANCH)"
git fetch --all --prune
git reset --hard "origin/$BRANCH"

echo "==> 2/7 安装依赖"
npm ci

echo "==> 3/7 切换 Prisma provider 为 postgresql"
SCHEMA="server/prisma/schema.prisma"
if grep -q 'provider = "sqlite"' "$SCHEMA"; then
  sed -i 's/provider = "sqlite"/provider = "postgresql"/' "$SCHEMA"
  echo "    已切换为 postgresql"
else
  echo "    已是 postgresql，跳过"
fi

echo "==> 4/7 生成 Prisma Client"
npx prisma generate --schema "$SCHEMA"

echo "==> 5/7 同步数据库结构"
npx prisma db push --schema "$SCHEMA" --skip-generate

echo "==> 6/7 构建"
npm run build:shared
npm run build -w server
npm run build -w web

echo "==> 7/7 重启 API 服务"
sudo systemctl restart carbon-ledger
sleep 2
sudo systemctl is-active carbon-ledger

echo "==> 健康检查"
curl -fsS http://127.0.0.1:3000/api/health && echo

echo "部署完成：https://arcnum.cn"