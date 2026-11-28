# CarbonLedger

建筑工程“建造阶段”碳排放核算与成本分析的多用户 Web 平台（MVP）。

以旧项目 ProjectCarbonCal（Vue 3 单机版）为业务基线，保留其全部核算功能与口径，新增：

- 服务器端数据持久化（注册申请 / 管理员审批 / 登录 / 多用户项目隔离）
- 核算版本（手动保存、不可变快照、历史可查）
- PDF + Excel 报告导出（沿用旧版报告内容）
- 建材 / 运输 / 施工 XLSX 清单导入导出（沿用旧版格式）
- Linux 云服务器部署与域名 HTTPS 访问（后续上云）

## 仓库结构

```
CarbonLedger/
├─ packages/shared/   # 领域类型 + 核算引擎（前后端共享，公式与旧版一致）
├─ server/            # NestJS + TypeScript + Prisma 后端 API
├─ web/               # Vue 3 + TypeScript + Vite 前端
└─ docs/              # 架构与部署文档
```

## 本地开发

```bash
npm install          # 根目录一次安装全部 workspace
npm run build       # 按 shared → server → web 顺序构建
npm run typecheck   # 三个 workspace 的 TypeScript 检查
npm run dev:server  # 后端 http://localhost:3000
npm run dev:web     # 前端 http://localhost:5173
npm test            # 运行全部测试
npm run check       # 发布前完整检查：类型、测试、构建与 bundle 预算
npm run preview -w web -- --host 127.0.0.1  # 预览 web/dist（默认 4173 端口）
npm run smoke:production  # HTTP + Chrome/CDP 浏览器挂载冒烟（需先构建并启动 preview）
```

`npm run smoke:production` 不新增 npm 依赖：它通过 Node 内置模块检查首页、客户页和设计预览页的 HTML/module 资源，并在本机已有 Chrome/Chromium 下用 CDP 确认 Vue 挂载。没有浏览器时可设置 `SMOKE_SKIP_CDP=1` 只运行 HTTP 检查；设置 `SMOKE_CHROME_PATH` 可指定浏览器。可选 `SMOKE_API_URL`（例如 `http://127.0.0.1:3000/api/`）会额外检查 `/health`，但不会自动启动 API 或数据库。

GitHub Actions 的 `Quality` 工作流执行 `npm ci`、`npm run check`，安装 Chrome 并对构建后的 Vite preview 执行浏览器冒烟；它不声称验证数据库/API 集成。详见 `docs/ARCHITECTURE.md`。
