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
npm run build

echo "==> 7/7 重启 API 服务"
sudo systemctl restart carbon-ledger

echo "==> 健康检查（最多等待 24 秒）"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/api/health}"
HEALTH_ATTEMPTS=12
HEALTH_OK=0
for attempt in $(seq 1 "$HEALTH_ATTEMPTS"); do
  if sudo systemctl is-active --quiet carbon-ledger && curl -fsS "$HEALTH_URL"; then
    HEALTH_OK=1
    echo
    echo "    健康检查通过（第 ${attempt}/${HEALTH_ATTEMPTS} 次）"
    break
  fi
  echo "    服务仍在启动（第 ${attempt}/${HEALTH_ATTEMPTS} 次），2 秒后重试..." >&2
  sleep 2
done
if [[ "$HEALTH_OK" -ne 1 ]]; then
  echo "错误：服务在 ${HEALTH_ATTEMPTS} 次检查后仍未通过健康检查。" >&2
  sudo systemctl --no-pager --full status carbon-ledger || true
  exit 1
fi

echo "部署完成：http://111.229.48.14/"