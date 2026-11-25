#!/usr/bin/env bash
# CarbonLedger 服务器端部署脚本（在服务器上执行）
# 用法：sudo -u ubuntu bash scripts/deploy.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/carbon-ledger}"
BRANCH="${BRANCH:-main}"

cd "$APP_DIR"

if [[ ! -r server/.env ]]; then
  echo "错误：缺少可读的 server/.env 生产配置。" >&2
  exit 1
fi
set -a
source server/.env
set +a

if [[ -n "$(git status --porcelain)" ]]; then
  echo "错误：工作树存在未提交改动；为避免覆盖服务器数据或运维修复，停止部署。" >&2
  exit 1
fi

echo "==> 1/7 拉取代码 ($BRANCH)"
git fetch --all --prune
if ! git show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
  echo "错误：远端分支 origin/$BRANCH 不存在。" >&2
  exit 1
fi
PREVIOUS_COMMIT="$(git rev-parse HEAD)"
NEXT_COMMIT="$(git rev-parse "origin/$BRANCH")"
echo "    当前版本：$PREVIOUS_COMMIT"
echo "    目标版本：$NEXT_COMMIT"
git reset --hard "origin/$BRANCH"

echo "==> 2/7 安装依赖"
npm ci

echo "==> 3/7 准备生产 Prisma schema"
SCHEMA="server/prisma/schema.production.prisma"
trap 'rm -f -- "$SCHEMA"' EXIT
sed 's/provider = "sqlite"/provider = "postgresql"/' server/prisma/schema.prisma > "$SCHEMA"
if grep -q 'provider = "sqlite"' "$SCHEMA"; then
  echo "错误：无法将 Prisma provider 切换为 postgresql。" >&2
  exit 1
fi

echo "==> 4/7 生成 Prisma Client"
DATABASE_URL="$DATABASE_URL" npx prisma generate --schema "$SCHEMA"

echo "==> 5/7 同步数据库结构"
DATABASE_URL="$DATABASE_URL" npx prisma db push --schema "$SCHEMA" --skip-generate

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