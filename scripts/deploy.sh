#!/usr/bin/env bash
# CarbonLedger 服务器端部署脚本（在服务器上执行）
#
# 正常发布（安全地跟随 origin/main 的当前提交）：
#   bash scripts/deploy.sh
# 指定已经审核过的提交（发布或回滚）：
#   TARGET_SHA=<完整 40 位 commit SHA> bash scripts/deploy.sh
#
# 脚本只会部署经过 Git 校验的固定提交；不会把一个移动中的分支直接交给
# git reset。脚本不会自动备份或回滚数据库，发布前请按部署文档操作。
set -Eeuo pipefail

DEPLOY_APP_DIR="${APP_DIR:-/opt/carbon-ledger}"
DEPLOY_BRANCH="${BRANCH:-main}"
DEPLOY_REQUESTED_SHA="${TARGET_SHA:-}"
DEPLOY_READINESS_URL="${READINESS_URL:-${HEALTH_URL:-http://127.0.0.1:3000/api/health/ready}}"

if [[ "$#" -gt 1 ]]; then
  echo "用法：$0 [完整 40 位 TARGET_SHA]" >&2
  exit 2
fi
if [[ "$#" -eq 1 ]]; then
  if [[ -n "$DEPLOY_REQUESTED_SHA" ]]; then
    echo "错误：不要同时使用位置参数和 TARGET_SHA。" >&2
    exit 2
  fi
  DEPLOY_REQUESTED_SHA="$1"
fi

if [[ -n "$DEPLOY_REQUESTED_SHA" && ! "$DEPLOY_REQUESTED_SHA" =~ ^[0-9a-fA-F]{40}$ ]]; then
  echo "错误：TARGET_SHA 必须是完整的 40 位十六进制 commit SHA。" >&2
  exit 2
fi
if [[ ! "$DEPLOY_BRANCH" =~ ^[A-Za-z0-9._/-]+$ || "$DEPLOY_BRANCH" == /* || "$DEPLOY_BRANCH" == *..* ]]; then
  echo "错误：BRANCH 不是安全的分支名：$DEPLOY_BRANCH" >&2
  exit 2
fi
if [[ -z "$DEPLOY_READINESS_URL" || ! "$DEPLOY_READINESS_URL" =~ ^https?:// ]]; then
  echo "错误：READINESS_URL 必须是 http:// 或 https:// URL。" >&2
  exit 2
fi

cd "$DEPLOY_APP_DIR"

if [[ ! -r server/.env ]]; then
  echo "错误：缺少可读的 server/.env 生产配置。" >&2
  exit 1
fi
set -a
# shellcheck disable=SC1091
source server/.env
set +a

if [[ -n "$(git status --porcelain)" ]]; then
  echo "错误：工作树存在未提交改动；为避免覆盖服务器数据或运维修复，停止部署。" >&2
  exit 1
fi

echo "==> 1/7 获取远端提交 ($DEPLOY_BRANCH)"
git fetch --all --prune
REMOTE_REF="refs/remotes/origin/$DEPLOY_BRANCH"
# 显式 SHA 可用于回滚已保留的提交，不要求该提交仍属于当前远端分支；
# 无参数的日常发布才要求 origin/$DEPLOY_BRANCH 存在并解析为固定 SHA。
if [[ -n "$DEPLOY_REQUESTED_SHA" ]]; then
  TARGET_SHA="${DEPLOY_REQUESTED_SHA,,}"
  if ! git cat-file -e "${TARGET_SHA}^{commit}"; then
    echo "错误：TARGET_SHA 不是当前仓库可验证的 commit：$TARGET_SHA" >&2
    exit 1
  fi
else
  if ! git show-ref --verify --quiet "$REMOTE_REF"; then
    echo "错误：远端分支 origin/$DEPLOY_BRANCH 不存在。" >&2
    exit 1
  fi
  TARGET_SHA="$(git rev-parse --verify "${REMOTE_REF}^{commit}")"
fi

if [[ ! "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "错误：无法解析出完整、可验证的目标 SHA。" >&2
  exit 1
fi
TARGET_SHA="$(git rev-parse --verify "${TARGET_SHA}^{commit}")"
PREVIOUS_COMMIT="$(git rev-parse HEAD)"
echo "    当前版本：$PREVIOUS_COMMIT"
echo "    已验证目标版本：$TARGET_SHA"
if [[ "$PREVIOUS_COMMIT" == "$TARGET_SHA" ]]; then
  echo "    工作树已经在目标版本，仍继续执行依赖安装、构建和就绪检查。"
fi

git reset --hard "$TARGET_SHA"
if [[ "$(git rev-parse HEAD)" != "$TARGET_SHA" ]]; then
  echo "错误：检出后的 HEAD 与已验证目标 SHA 不一致，停止部署。" >&2
  exit 1
fi

echo "==> 2/8 安装完整构建依赖"
NPM_CONFIG_PRODUCTION=false NODE_ENV=development npm ci --include=dev

echo "==> 3/8 准备生产 Prisma schema"
SCHEMA="server/prisma/schema.production.prisma"
trap 'rm -f -- "${SCHEMA:-}"' EXIT
sed 's/provider = "sqlite"/provider = "postgresql"/' server/prisma/schema.prisma > "$SCHEMA"
if grep -q 'provider = "sqlite"' "$SCHEMA"; then
  echo "错误：无法将 Prisma provider 切换为 postgresql。" >&2
  exit 1
fi

echo "==> 4/8 生成 Prisma Client"
DATABASE_URL="$DATABASE_URL" npx prisma generate --schema "$SCHEMA"

echo "==> 5/8 同步数据库结构"
DATABASE_URL="$DATABASE_URL" npx prisma db push --schema "$SCHEMA" --skip-generate

echo "==> 6/8 构建"
NPM_CONFIG_PRODUCTION=false NODE_ENV=development npm run build

echo "==> 7/8 准备运行时依赖"
npm prune --omit=dev

echo "==> 8/8 重启 API 服务"
sudo systemctl restart carbon-ledger

echo "==> 就绪检查（最多等待 24 秒）"
READINESS_ATTEMPTS=12
READINESS_OK=0
check_readiness() {
  local body
  sudo systemctl is-active --quiet carbon-ledger || return 1
  body="$(curl --fail --silent --show-error --max-time 5 --proto '=http,https' --tlsv1.2 "$DEPLOY_READINESS_URL")" || return 1
  grep -Eq '"status"[[:space:]]*:[[:space:]]*"ok"' <<<"$body"
}
for attempt in $(seq 1 "$READINESS_ATTEMPTS"); do
  if check_readiness; then
    READINESS_OK=1
    echo "    就绪检查通过（第 ${attempt}/${READINESS_ATTEMPTS} 次）：$DEPLOY_READINESS_URL"
    break
  fi
  echo "    服务尚未就绪（第 ${attempt}/${READINESS_ATTEMPTS} 次），2 秒后重试..." >&2
  sleep 2
done
if [[ "$READINESS_OK" -ne 1 ]]; then
  echo "错误：服务在 ${READINESS_ATTEMPTS} 次就绪检查后仍未通过。" >&2
  echo "       目标版本：$TARGET_SHA；上一版本：$PREVIOUS_COMMIT" >&2
  echo "       脚本不会自动回滚；请先查看日志，并按 docs/DEPLOYMENT.md 的回滚步骤操作。" >&2
  sudo systemctl --no-pager --full status carbon-ledger || true
  exit 1
fi

echo "部署完成：版本 $TARGET_SHA"
