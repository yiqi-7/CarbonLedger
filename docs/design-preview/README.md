# 四种前端设计方案

入口：开发服务中的 `/design-preview.html`。例如：

- `http://127.0.0.1:5174/design-preview.html?style=ibm&page=overview`
- `http://127.0.0.1:5174/design-preview.html?style=sap&page=overview`
- `http://127.0.0.1:5174/design-preview.html?style=notion&page=overview`
- `http://127.0.0.1:5174/design-preview.html?style=stripe&page=overview`

页面顶部切换 A–D 方案和项目概览、建材清单、项目信息、项目目录、登录页。URL 保留当前选择，可直接分享具体方案。开发端口以 Vite 实际输出为准；生产构建也包含独立的 `design-preview.html` 入口。

| 方案 | 参考 | 设计关系 | 适用偏好 |
| --- | --- | --- | --- |
| A | IBM | 黑色应用栏、垂直导航、方角、紧凑数据栅格、纯蓝动作 | 信息密度高、结构明确 |
| B | SAP | 灰白应用栏、横向业务页签、宽幅内容带、蓝色标题与动作 | 常规业务系统、容易理解 |
| C | Notion | 暖灰目录、中央文档画布、开放表格、属性区、少量紫色动作 | 轻量阅读、较少容器装饰 |
| D | Stripe | 深蓝文字、靛蓝动作、分析主区和右侧摘要、分组表单 | 数字分析、精细排版 |

这是供选择的候选界面。当前正式应用、客户原始页面、认证和项目数据接口未替换。用户选定后再将相应视觉方向应用到真实功能。

## 可试用的行为

所有版本共用一份示例项目和清单。可搜索、筛选、编辑、添加材料、导出当前清单 CSV，修改项目资料并查看合计更新。编辑只在当前页面会话生效，刷新恢复示例值；“标记为首选”只将方案编号保存到浏览器，不应用到正式版。登录页的“进入预览”进入示例目录，无需真实凭据，也不发送凭据。

生产阶段排放 = Σ(建材数量 × 示例碳排放因子) / 1000；建材费用 = Σ(建材数量 × 示例单价) / 10000。运输 368.4、施工 184.6、回收抵扣 48.9 tCO₂e 是固定示例，界面明确提示。单位面积排放以正向建造阶段合计为分子，与抵扣后的净排放分开呈现。

## 来源与适配

来源：[VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md)，固定版本 `fcc70284932276d085f01ef9f83edde90b1258cb`，MIT 许可证见 [LICENSE.awesome-design-md](LICENSE.awesome-design-md)。仓库提供设计分析文档，不是品牌后台源代码。以下公开参考均已于 2026-11-25 在浏览器中查看实际渲染：

- [IBM 参考](https://getdesign.md/design-md/ibm/preview.html)
- [SAP 参考](https://getdesign.md/design-md/sap/preview.html)
- [Notion 参考](https://getdesign.md/design-md/notion/preview.html)
- [Stripe 参考](https://getdesign.md/design-md/stripe/preview.html)

本项目按这些分析提取配色、字重、间距、几何和信息层级，用自己的 Vue 组件实现工程工作界面，不声称为品牌官方实现。公开预览中部分为营销页，其营销背景和宣传内容未迁入业务界面。使用本项目现有 Element Plus SVG 图标及系统中文字体栈，没有引入品牌标志、专有字体或网站图片。

本机安装的 `awesome-design-md` 是本地 Codex 适配 skill，包含 84 个品牌文档与上游许可证。安装目录属于个人工具环境，不是应用运行依赖；其他开发者无需安装 skill 即可运行四版预览。

## 验证

验证范围包括四版桌面与手机实际渲染、320px 页面溢出、搜索空态、类别过滤、材料编辑合计、项目信息保存、登录预览跳转、项目目录返回和键盘焦点。运行仓库现有测试、前端 TypeScript 检查和 Vite 构建。这里是视觉与交互比较环境，不承担正式核算或服务器存储。

2026-11-25 验证结果：前端 56 项、共享计算 28 项测试通过；`npm run build -w web` 通过；Impeccable 检查未报告问题。后端测试在 Prisma 创建独立测试数据库时发生 `Schema engine error`，用例未执行；未修改后端。构建仍提示正式应用既有的大包体积警告。
