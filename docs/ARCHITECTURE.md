# CarbonLedger 架构设计

## 1. 总体架构

```
┌─────────────┐        HTTP/JSON        ┌──────────────────┐        Prisma        ┌───────────┐
│  web (Vue3)  │  ───────────────────▶  │  server (NestJS) │  ──────────────────▶ │  Database │
│  Vite + TS   │   JWT Bearer 认证      │  REST API        │   dev: SQLite        │           │
└─────────────┘                         │  权威计算/版本/导出 │   prod: PostgreSQL   └───────────┘
        ▲                               └────────┬─────────┘
        │                                        │ exceljs / pdfkit
        └──── 静态托管 dist（部署时由 server 托管或 Nginx）   ▼
                                             XLSX / PDF 文件（内存生成后流式返回）
```

- **所有业务数据、权威核算计算、版本快照与报告生成都在服务器执行**；浏览器仅做展示与交互。
- 前后端共享核算引擎 `@carbonledger/shared`，公式与旧项目完全一致；服务端结果是权威值，前端仅用于即时反馈。

## 2. 目录职责

| 位置 | 职责 |
|---|---|
| `packages/shared` | 领域类型、常量（能源类型/因子）、核算引擎（派生字段、汇总、生命周期/成本分析、回收联动同步）、导入导出列定义 |
| `server` | NestJS 模块：auth（注册申请/审批/登录 JWT）、users、projects、factors、records（建材/运输/施工/回收）、analysis、versions（不可变快照）、reports（PDF+Excel）、import-export、audit、admin |
| `web` | Vue Router + Pinia + Element Plus；登录/注册/待审批、项目列表、项目工作区（信息/因子/四类数据/分析/版本）、管理员控制台 |

## 3. 数据模型（Prisma）

| 表 | 说明 |
|---|---|
| `User` | username(唯一)、passwordHash(bcrypt)、remark、role(ADMIN/USER)、status(PENDING/APPROVED/REJECTED) |
| `Project` | 归属 ownerId；项目信息字段与旧版一致（名称、省/市区、地址、建筑面积、楼层、类型、结构、设计年限、起止日期、负责人、核算标准、模型图片 dataURL） |
| `BuildFactorConfig` / `TransportFactorConfig` | 项目级因子配置（对应旧“建筑碳排配置/运输碳排配置”，转为项目级） |
| `BuildMaterial` / `TransportRecord` / `ConstructionRecord` / `RecyclingRecord` | 四类业务记录；派生字段（排放量/总价等）由服务端按共享引擎计算后存储 |
| `RecyclingRecord.sourceBuildMaterialId` | 与建材记录外键式关联（自动联动）；`isCustomMaterial` 区分自定义记录 |
| `CalcVersion` | 版本号（项目内自增）+ 快照 JSON（Text）；不可变 |
| `AuditLog` | 操作者、动作、目标、时间、结果 |

> 开发/测试期使用 SQLite（`server/prisma/schema.prisma` provider=sqlite）；部署上云时把 provider 切换为 postgresql 并执行 `prisma db push`（见 docs/DEPLOYMENT.md）。快照等 JSON 内容以字符串列存储，两种数据库通用。

## 4. 核算公式（与旧版 ProjectCarbonCal 完全一致）

| 项 | 公式 | 单位 |
|---|---|---|
| 建材排放 | `用量 × 碳排因子 ÷ 1000` | t |
| 建材总价 | `用量 × 成交价 ÷ 10000` | 万元 |
| 运输排放 | `运距 × 运输量 × 因子 ÷ 1000` | t |
| 运输总价 | `运距 × 运输单价 ÷ 10000`（旧版原式，未乘运输量） | 万元 |
| 施工能耗 | `台班数 × 单位台班能耗` | kWh 或 kg |
| 施工排放 | `能耗 × 能源因子`（电力 0.581 / 柴油 2.632 / 汽油 2.34），展示 ÷1000 | kg → t |
| 施工总价 | `台班数 × 台班单价 ÷ 10000` | 万元 |
| 回收减碳 | `回收量 × 回收因子 × 回收系数 ÷ 1000` | t |
| 回收残值 | `回收量 × 单价 ÷ 10000` | 万元 |
| 建材汇总 | 排放合计 / 成本合计 / 单位面积排放 `合计×1000÷面积` | t、万元、kg/m² |
| 运输汇总 | 合计 + 柴油/汽油分项与占比 | t、% |
| 施工汇总 | 台班合计、能耗/排放按能源分项与占比 | — |
| 回收汇总 | 减碳合计、回收量合计、利用率 `减碳÷建材排放×100`、残值合计 | — |
| 生命周期 | `建材 + 运输 + 施工/1000 − 回收` = 净排放 | t |
| 单位面积净排放 | `净排放 ×1000 ÷ 面积` | kg/m² |
| 总成本 | 建材 + 运输 + 施工总价 | 万元 |
| 单位成本碳排放 | `净排放 ÷ 总成本` | t/万元 |

回收自动联动（旧版 `syncRecyclingMaterialWithBuildMaterial` 行为）：

- 建材 `回收因子 > 0` → 自动创建/更新 `sourceBuildMaterialId` 关联的回收记录，初始回收量 = 建材用量；
- 建材用量改小 → 回收量收缩为 `min(现回收量, 建材用量)`；
- 建材回收因子归零或建材删除 → 关联回收记录移除（删除建材时同时移除同名无来源的非自定义回收记录）；
- 类别映射：金属/保温材料/玻璃沿用，其余为“其他”。

## 5. 认证与权限

- 注册申请：用户名 + 密码（≥6 位）+ 备注（≤200 字）→ `PENDING`；同名不可重复。
- 管理员审批 → `APPROVED` 后方可登录；`PENDING/REJECTED` 拒绝登录。
- JWT Bearer（默认 12h）；除注册/登录外全部接口需认证。
- 项目与全部子资源以 `ownerId` 隔离，服务端强制校验；管理员仅负责审批，不隐含项目数据访问权。
- 首位管理员由环境变量 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 在启动时初始化。
- 密码 bcrypt 哈希存储；登录失败提示统一，不暴露账号是否存在。

## 6. 核算版本

- 用户显式点击“保存核算版本”→ 服务端将项目信息、因子配置、四类记录（含派生值）与汇总序列化为快照存储，`versionNumber` 项目内自增。
- 核算 payload 不可变；版本名称存储为独立可变 metadata，后续编辑只影响当前数据与之后的新版本。历史 snapshot 中的名称仅作为兼容回退。
- 报告（PDF + Excel）从指定版本快照生成，不读取当前编辑态。

## 7. 导入 / 导出（与旧版格式一致）

| 类型 | 工作表 | 规则 |
|---|---|---|
| 建材导入 | `建材生产碳排放量`（或 `材料清单`） | 表头含 材料名称/类型(材料类别)/用量(使用量)；必填缺失整次报错；类别默认单位映射；回收因子/系数可选默认 0 |
| 运输导入 | `运输碳排放量`（或 `运输记录清单/运输记录`） | 表头含 车辆名称(车辆)/运输货物/运输量/运距(运输距离/远距)/能源类型/碳排放因子(碳排因子)/运输单价(运输价)；单价表头含“万元”自动 ×10000；空/不完整行跳过计数 |
| 施工导入 | `施工碳排放量`（或 `工程台班清单`） | 表头含 机械名称/台班数/能源类型/单位台班能耗/碳排放因子/台班单价；台班数须正整数；不完整行跳过计数 |
| 清单导出 | `材料清单` / `运输清单` / `工程台班清单` | 列与旧版导出完全一致 |
| 报告导出 | 旧模板 `报告书导出.xlsx`（项目总览/建材/运输/施工/回收） | 改写单元格 + 插入数据行 + 打印区域 + 项目图片；另出 PDF |

文件上限 20MB；能源类型仅 柴油/汽油（运输）与 电力/柴油/汽油（施工）。

## 8. 环境变量

| 变量 | 说明 | 默认 |
|---|---|---|
| `DATABASE_URL` | Prisma 连接串（dev: `file:./dev.db`） | — |
| `JWT_SECRET` | JWT 签名密钥 | dev 提供默认值，生产必须设置 |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | 首位管理员初始化 | 启动时若不存在则创建 |
| `PORT` | 服务端口 | 3000 |

## 9. 架构演进与依赖约束

### 9.1 总体架构：模块化单体（Modular Monolith）

CarbonLedger 采用模块化单体，而不是微服务。系统仍以一个 NestJS 服务部署，但业务按边界拆分为可独立演进的模块：

```text
Identity      auth / users / audit
Project       projects / factor configurations
Calculation   records / analysis / recycling synchronization
Snapshot      versions
Document      import-export / reports
```

选择模块化单体的原因：当前业务数据关系紧密，四类记录、分析、版本快照和报告之间存在强关联；保持单进程和单数据库可以避免分布式事务、跨服务认证和部署复杂度。模块边界稳定后，才评估是否需要独立部署某一能力。

### 9.2 依赖方向

依赖方向必须保持单向：

```text
web ─────▶ @carbonledger/shared
server ──▶ @carbonledger/shared
server ──▶ Prisma / 文件 / Excel / PDF 等基础设施
```

禁止以下依赖：

- `shared` 依赖 NestJS、Prisma、Vue、Axios、Express、DOM 或数据库驱动；
- `web` 依赖 server 源码、Prisma 或数据库；
- `server` 依赖 web 源码；
- controller 直接访问 Prisma；
- customer feature 直接拼接项目 API URL或跨 feature 引用内部文件。

`packages/shared` 是纯计算内核，只提供领域类型、常量、纯公式、汇总分析和纯回收规则。服务器结果是权威值，浏览器本地计算只用于编辑态即时反馈，不能覆盖服务端派生值。

### 9.3 server 记录边界

记录模块保留稳定的 `RecordsService` facade，controller 和其他模块继续依赖 facade；内部职责按业务能力逐步拆分：

```text
RecordsController
        │
        ▼
RecordsService facade
        ├── BuildMaterialsService
        ├── TransportRecordsService
        ├── ConstructionRecordsService
        ├── RecyclingRecordsService
        └── RecyclingSyncService
```

`RecordsService` facade 必须保留现有方法名、参数顺序、返回结构和 `syncRecycling(projectId, materialIds)` 兼容入口。拆分内部服务不得改变 API URL、HTTP 方法、DTO、错误消息或 Prisma 返回字段。

#### RecordAccessService

`RecordAccessService` 是记录模块的项目归属权限边界，当前已实施。所有记录 CRUD 在第一次记录查询或写入前先执行：

```text
RecordAccessService.assertOwner(projectId, userId)
        ▼
记录查询/写入
```

它只适配并透传 `ProjectsService.assertOwner`，不复制项目查询、不改变 403/404 异常，也不把权限移动到 controller 或全局 Guard。新增记录入口必须经过该边界。

#### RecyclingSyncService

`RecyclingSyncService` 是回收联动的目标领域服务边界，负责数据库增量同步：

- 仅处理指定建材的自动回收记录；
- 保留现有自动记录 ID 和用户保留的单价；
- 按建材用量收缩回收量；
- 回收因子归零或来源删除时清理自动记录；
- 不因普通读取、分析或快照而重建用户删除的自动记录。

shared 中的 `syncRecyclingRecords()` 仍然是纯数组规则；server 的 `RecyclingSyncService` 负责 Prisma 协调，二者不能混用。当前 `RecordsService.syncRecycling()` 是兼容 facade，转发到 `RecyclingSyncService`，不能直接暴露给 controller。

### 9.4 ImportExport 统一授权约束

所有导入、导出和报告入口都必须在读取或写入项目数据前完成项目归属校验：

```text
CurrentUser.userId + projectId
        ▼
项目授权边界
        ▼
解析 / 查询 / 写入 / 导出
```

导入服务不得新增没有 `userId` 的公共写入 helper，不得绕过 RecordsService 的业务规则直接写入记录。导入文件解析、字段标准化和记录写入应保持分离；建材导入完成后仍通过 facade 的 `syncRecycling()` 触发既有增量联动。

内部调用允许在上游已完成授权后省略重复查询，但必须明确标注为内部协调入口，并保证所有查询、更新、删除继续带 `projectId` 作用域。

### 9.5 web customer 演进约束

customer 工作区采用轻量 Feature-Sliced 结构，按以下方向渐进迁移：

```text
apiProjectFacade
        ▼
useProjectPersistence
        ▼
useCustomerRuntime / useWorkspaceNavigation
        ▼
project-info / factor-config / import-export
        ▼
build-materials / transport-records / construction-records / recycling-records
        ▼
analysis / versions
```

迁移期间保留旧 data model 的兼容接口（`append`、`toArray`、`removeById`、`updateById`、`replaceAll`、`findByVehicleName`、`ProjectInfo` 和 `window.ProjectInfo`）。`App.vue` 逐步退化为页面编排层，不再新增 API 路径、保存队列、生命周期保护或四类记录的领域逻辑。

customer 的 API 只通过项目 facade 访问；iframe 通信只通过 `bridge.ts` 的类型和消息守卫登记。新增消息不得散落协议字符串，host 侧必须继续校验 origin、iframe source 和消息结构。

当前阶段已完成：

- customer persistence/runtime 生命周期保护、分析排放与成本 view model、记录筛选、导入导出交互、项目版本/报告 API facade、记录保存/删除队列协调、四类记录字段校验 handler，以及建材因子配置/临时行协调已拆成独立边界；`App.vue` 继续组合旧 data model 与模板 handler。
- `RecordsService` facade 已将建材、运输、施工、回收 CRUD 分别委托给内部服务；导入写入也通过授权后的 facade 内部入口，回收增量联动仍由 `RecyclingSyncService` 负责。
- `AnalysisService` 已拆为授权数据 loader 与 shared 公式 calculator；`ReportsService` 已拆为 Excel/PDF renderer；`VersionsService` 已拆为 snapshot factory 与 project-scoped repository。
- shared/web/server controller 依赖方向已有 AST 架构测试；records 内部 deep import 使用精确 baseline，已有违规不得增加。

仍待逐步完成：

- customer `App.vue` 中的项目编辑；新增 feature 不应继续堆入此文件。
- `ProjectToolsView.vue` 已通过项目 API facade 访问项目、因子、版本和报告；Versions 已将名称更新迁移到独立 metadata，并保留历史 snapshot 名称回退。
- 版本编号已增加限定 composite unique 冲突的有界重试，并在重试时重建带最终编号的 snapshot；仍待 customer 版本页面和报告页面的 feature 归属迁移。
- 最后的 JavaScript data model 到 TypeScript 迁移。

### 9.6 API、数据和持久化契约

架构演进必须保持以下公开契约：

- 现有 API URL、HTTP 方法和 DTO 校验行为不变；
- 现有响应字段、`null` 值、`projectId`、数组顺序和删除响应不变；
- 项目权限仍先于子资源查询，其他用户和管理员越权仍返回原有 403；
- 不存在项目仍返回 404，跨项目记录 ID 仍按原规则返回记录不存在；
- shared 计算结果、运输总价旧公式和回收增量同步语义不变；
- `CalcVersion` 的核算 payload 保持不可变；版本名称作为独立 metadata 允许更新，报告仍从当前数据或指定快照生成。

不得在内部服务拆分时直接引入会裁剪 Prisma 字段的白名单 response mapper。若未来需要版本化响应，使用新的 API contract 或 `/api/v2`，不破坏当前接口。

## 10. 迁移顺序

采用小步、可回滚、每阶段独立验证的迁移策略：

1. **架构基线**：锁定 API 路由、响应字段、权限矩阵、计算结果、iframe bridge 和模块依赖规则。
2. **权限边界**：完成并验证 `RecordAccessService`；新增记录入口必须统一经过项目授权。
3. **回收协调**：将数据库回收增量同步抽为 `RecyclingSyncService`，保留 `RecordsService` facade 和导入兼容入口。
4. **记录服务**：按建材、运输、施工、回收逐步拆分内部 service，先拆实现、后考虑 controller 物理拆分。
5. **customer 基础设施**：抽离 persistence、runtime 和 navigation composable。
6. **customer feature**：按项目基础信息、因子配置、导入导出、四类记录、分析和版本逐步迁移。
7. **文档能力**：统一导入 parser、导出 renderer、报告数据组装与 Excel/PDF renderer。
8. **类型迁移**：最后将 customer 的 JavaScript data model、工具和 feature state 逐步迁移为 TypeScript。

任何阶段不得同时改变数据库 schema、API 响应结构和业务计算结果；如需破坏性变化，必须另立版本化迁移。

## 11. 验收门禁

每个阶段合并前必须通过：

```text
npm run typecheck
git diff --check
npm test
npm run build
```

同时执行 UI detector，并确认架构依赖没有新增反向引用。涉及 server 业务边界时，还必须通过 server E2E 和模块装配验证；涉及 customer 时，必须通过 persistence、runtime、bridge、iframe session recovery 和 API facade 测试。

发布前必须确认：

- GitHub 分支指向待发布 commit；
- 线上 HEAD 与待发布 commit 一致；
- `systemctl is-active carbon-ledger` 为 `active`；
- `/api/health` 返回 HTTP 200；
- Git origin 已恢复为 GitHub 地址；
- 临时部署 bundle 已删除；
- 不提交 `.env`、`.jspace/`、数据库文件或构建产物。
