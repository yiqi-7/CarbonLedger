# 前端方案对比：开发契约

本轮用户要求从 VoltAgent/awesome-design-md 选择多个网站设计做可比较版本。正式界面的 DESIGN.md 不替换，候选界面在独立 design-preview.html 文档中运行。

四个方向：IBM 方角/紧凑数据栅格与黑色应用栏；SAP 灰色应用栏/横向业务页签与宽幅内容带；Notion 暖灰目录/文档式阅读与属性表；Stripe 深蓝字/靛蓝动作与分析摘要侧栏。都适配碳建智算平台的原有业务对象、名称与核算口径。

用户后续要求增加艺术方向，新增 E Oura 建筑画册、F Figma 色块构成、G WIRED 黑白刊物、H Clay 艺术工作室，具体方向见 ART-DIRECTIONS.md。预览分组选择，仍遵守本文件共享业务契约。新增方向使用本地许可中文字体，并以 --lab-toolbar-height 实际工具栏高度计算登录居中区。

比较基准：同一个明确标记为示例的项目，4条建材记录，准确合计，统一交互。每版提供概览、材料清单、项目信息、项目目录、登录。示例编辑只在当前预览会话生效，不请求项目API。

主屏：1280×720；手机390px和最窄320px。标题、表格、数字、按钮分别建立层级，长表内部滚动，键盘焦点可见。没有第三方商标、营销图、未经许可的专有字体。参考公开分析的设计关系，不声称复制品牌后台源码。

共享组件契约：
- 每个 variants/*.vue 接收 props { page: PageId }，defineEmits<{ navigate: [page: PageId] }>()。
- import type { PageId } from '../types'; import { usePreview } from '../state'; const state = usePreview()。
- state.project 是响应式项目，字段 name/location/type/area/manager/standard；state.totalEmission, state.netEmission, state.totalCost 是ComputedRef。
- import PreviewContent from '../PreviewContent.vue'; <PreviewContent :page="page" @navigate="emit('navigate', $event)" />。
- 共享内容结构：.preview-content .content-heading(h1,p,.heading-actions), .overview-grid(.metrics-strip .metric-cell,.stage-panel,.ledger-panel,.project-summary), .panel-heading, .stage-bars,.stage-row,.table-scroll,.preview-table,.table-toolbar,.field-grid,.preview-field,.primary-action,.secondary-action,.text-action。
- CSS自定义属性：--v-bg,--v-surface,--v-text,--v-muted,--v-line,--v-accent,--v-tint,--v-radius,--v-font,--v-title-weight,--v-title-size（各方向根元素设置）。共享组件功能由root维护，允许各版本用不scoped样式在自身根class下覆盖布局/密度/边框。
- 版本外壳应有导航到 overview, materials, project, projects；login显示相应主题的居中表单（共享内容）。品牌名统一碳建智算平台。禁止无效假按钮，功能没做就不要显示交互。
- 根壳最小高度calc(100svh - 96px)，可使用 .variant-body 放主内容。共享内容负责页名与主要操作，版本壳别重复页名。
- 使用项目现有@element-plus/icons-vue组件，不引入新UI依赖。SVG统一16–20px。

退出条件：所有版本渲染并实看桌面/手机；表格搜索、筛选、编辑、空状态可用；来源记录和许可证完整；最终由用户选择方向，当前正式版保持现状。
