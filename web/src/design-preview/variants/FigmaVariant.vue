<script setup lang="ts">
import { ArrowLeft, DataAnalysis, Document, FolderOpened, Setting, User } from '@element-plus/icons-vue'
import PreviewContent from '../PreviewContent.vue'
import { usePreview } from '../state'
import type { PageId } from '../types'

defineProps<{ page: PageId }>()
const emit = defineEmits<{ navigate: [page: PageId] }>()
const state = usePreview()
const navigation = [
  { id: 'overview' as const, label: '项目概览', icon: DataAnalysis },
  { id: 'materials' as const, label: '建材清单', icon: Document },
  { id: 'project' as const, label: '项目信息', icon: Setting },
  { id: 'projects' as const, label: '项目目录', icon: FolderOpened },
]
</script>

<template>
  <div class="figma-variant" :class="{ 'figma-login': page === 'login' }">
    <aside v-if="page !== 'login'" class="figma-rail">
      <button class="figma-brand" type="button" @click="emit('navigate', 'projects')">
        <span>碳建智算</span><span>平台</span>
      </button>
      <nav class="figma-navigation" aria-label="项目功能">
        <button
          v-for="item in navigation"
          :key="item.id"
          type="button"
          :class="{ active: page === item.id }"
          :aria-current="page === item.id ? 'page' : undefined"
          @click="emit('navigate', item.id)"
        >
          <component :is="item.icon" aria-hidden="true" />
          <span>{{ item.label }}</span>
        </button>
      </nav>
      <p class="figma-rail-note">建造阶段<br />碳排放核算</p>
    </aside>

    <div class="figma-canvas">
      <header v-if="page !== 'login'" class="figma-project-bar">
        <button class="figma-back" type="button" aria-label="返回我的项目" @click="emit('navigate', 'projects')">
          <ArrowLeft aria-hidden="true" /><span>我的项目</span>
        </button>
        <span v-if="page !== 'projects'" class="figma-project-name">{{ state.project.name }}</span>
        <button class="figma-account" type="button" @click="emit('navigate', 'login')"><User aria-hidden="true" /><span>登录页</span></button>
      </header>
      <main class="variant-body figma-main">
        <PreviewContent :page="page" @navigate="emit('navigate', $event)" />
      </main>
    </div>
  </div>
</template>

<style>
.figma-variant {
  --v-bg: #faf9f6;
  --v-surface: #fff;
  --v-text: #171716;
  --v-muted: #56534d;
  --v-line: #c6c3bc;
  --v-accent: #171716;
  --v-tint: #eeeadf;
  --v-radius: 0px;
  --v-font: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  --v-title-weight: 700;
  --v-title-size: 44px;
  --figma-rule: #2c2b28;
  display: grid;
  grid-template-columns: 124px minmax(0, 1fr);
  min-height: calc(100svh - var(--lab-toolbar-height, 96px));
  color: var(--v-text);
  background: var(--v-bg);
  font-family: var(--v-font);
  font-size: 14px;
}
.figma-variant ::selection { color: #171716; background: #dceeb1; }
.figma-variant :is(button, a, input, select):focus-visible { outline: 3px solid #6a35c7; outline-offset: 3px; }
.figma-variant .figma-rail { display: flex; flex-direction: column; padding: 27px 14px 24px; border-right: 1px solid var(--figma-rule); background: #fff; }
.figma-variant .figma-brand { border: 0; background: transparent; padding: 0 4px; color: #171716; font-family: 'Preview Sans', var(--v-font); font-size: 20px; font-weight: 700; line-height: 1.5; letter-spacing: -.035em; text-align: left; }
.figma-variant .figma-brand span { display: block; }
.figma-variant .figma-navigation { display: grid; gap: 9px; margin-top: 38px; }
.figma-variant .figma-navigation button { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; min-height: 82px; padding: 12px 4px; border: 1px solid transparent; background: transparent; color: #56534d; font-size: 12px; }
.figma-variant .figma-navigation button:hover { background: #f4ecd6; color: #171716; }
.figma-variant .figma-navigation button.active { background: #c5b0f4; color: #171716; border-color: var(--figma-rule); font-weight: 600; }
.figma-variant .figma-navigation svg { width: 21px; height: 21px; }
.figma-variant .figma-rail-note { margin: auto 0 0; padding: 42px 8px 0; color: var(--v-muted); font-size: 11px; line-height: 1.9; }
.figma-variant .figma-canvas { min-width: 0; }
.figma-variant .figma-project-bar { display: flex; align-items: center; gap: 24px; min-height: 70px; padding: 12px 38px; border-bottom: 1px solid var(--figma-rule); background: #fff; }
.figma-variant .figma-back, .figma-variant .figma-account { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 36px; border: 0; padding: 6px 0; background: transparent; color: #171716; font-size: 12px; white-space: nowrap; }
.figma-variant .figma-back:hover, .figma-variant .figma-account:hover { text-decoration: underline; text-underline-offset: 4px; }
.figma-variant .figma-project-name { min-width: 0; padding-left: 24px; border-left: 1px solid #c6c3bc; color: var(--v-muted); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.figma-variant .figma-account { margin-left: auto; }
.figma-variant .figma-main { max-width: 1600px; margin: 0 auto; padding: 38px; }
.figma-variant .content-heading { align-items: flex-end; gap: 24px; margin-bottom: 32px; }
.figma-variant .content-heading h1 { font-family: 'Preview Sans', var(--v-font); line-height: 1.2; letter-spacing: -.04em; }
.figma-variant .content-heading p { font-size: 13px; margin-top: 15px; }
.figma-variant .primary-action, .figma-variant .secondary-action { min-height: 42px; padding: 11px 18px; border: 1px solid var(--figma-rule); border-radius: 24px; font-weight: 500; }
.figma-variant .primary-action { color: #fff; background: #171716; }
.figma-variant .primary-action:hover { background: #383732; }
.figma-variant .secondary-action { background: transparent; color: #171716; }
.figma-variant .secondary-action:hover { background: #dceeb1; border-color: var(--figma-rule); }
.figma-variant .text-action { padding: 7px 5px; color: #171716; }
.figma-variant .text-action:hover { background: #dceeb1; }
.figma-variant .overview-grid { display: grid; grid-template-columns: minmax(245px, .78fr) minmax(0, 1.65fr); grid-template-areas: 'metrics stages' 'ledger ledger' 'summary summary'; gap: 0; border: 1px solid var(--figma-rule); background: #fff; }
.figma-variant .metrics-strip { grid-area: metrics; display: flex; flex-direction: column; border: 0; border-right: 1px solid var(--figma-rule); border-radius: 0; background: transparent; }
.figma-variant .metric-cell { display: block; flex: 1; padding: 23px 25px; background: #dceeb1; }
.figma-variant .metric-cell:nth-child(2) { background: #c5b0f4; }
.figma-variant .metric-cell:nth-child(3) { background: #f3c9b6; }
.figma-variant .metric-cell + .metric-cell { border-left: 0; border-top: 1px solid var(--figma-rule); }
.figma-variant .metric-cell > span, .figma-variant .metric-cell p, .figma-variant .metric-cell small { color: #3f3c34; }
.figma-variant .metric-cell > div { display: flex; flex-direction: row; gap: 8px; align-items: baseline; justify-content: flex-start; margin: 6px 0 4px; }
.figma-variant .metric-cell strong { font-size: 29px; font-weight: 500; letter-spacing: -.035em; }
.figma-variant .metric-cell:first-child strong { font-size: 38px; }
.figma-variant .metric-cell p { max-width: none; font-size: 11px; }
.figma-variant .stage-panel { grid-area: stages; display: flex; flex-direction: column; justify-content: center; padding: 10px 12px; border: 0; border-radius: 0; background: #fff; }
.figma-variant .stage-panel .panel-heading { padding-bottom: 26px; }
.figma-variant .panel-heading h2 { font-family: 'Preview Sans', var(--v-font); font-size: 18px; font-weight: 500; }
.figma-variant .stage-bars { gap: 25px; padding-bottom: 28px; }
.figma-variant .stage-label { font-size: 13px; margin-bottom: 12px; }
.figma-variant .stage-label strong { font-size: 15px; }
.figma-variant .stage-label small { color: #56534d; }
.figma-variant .stage-track { height: 12px; border: 1px solid #2c2b28; background: #f4f2ec; }
.figma-variant .stage-fill { min-width: 3px; height: 100%; background: #292820; }
.figma-variant .stage-1 { background: #78689c; opacity: 1; }
.figma-variant .stage-2 { background: #a66848; opacity: 1; }
.figma-variant .recovery-line { border-top-color: #c6c3bc; padding-top: 18px; padding-bottom: 12px; }
.figma-variant .net-line { padding-top: 0; padding-bottom: 20px; }
.figma-variant .net-line strong { font-size: 22px; font-weight: 500; }
.figma-variant .ledger-panel { grid-area: ledger; border: 0; border-top: 1px solid var(--figma-rule); border-radius: 0; background: #fff; }
.figma-variant .ledger-panel .panel-heading { padding: 23px 25px; }
.figma-variant .project-summary { grid-area: summary; display: grid; grid-template-columns: 170px minmax(0, 1fr); gap: 16px 26px; padding: 26px; border: 0; border-top: 1px solid var(--figma-rule); border-radius: 0; background: #f4ecd6; }
.figma-variant .project-summary .panel-heading { align-self: start; padding: 0; gap: 12px; }
.figma-variant .project-summary .panel-heading h2 { font-size: 17px; }
.figma-variant .project-summary dl { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; padding: 0; }
.figma-variant .project-summary dl > div { display: block; }
.figma-variant .project-summary dd { margin-top: 7px; text-align: left; }
.figma-variant .project-summary .calculation-note { grid-column: 2; margin: 0; padding-top: 16px; border-top-color: #c6bfae; color: #565045; }
.figma-variant .preview-table { font-size: 13px; }
.figma-variant .preview-table th { padding-top: 13px; padding-bottom: 13px; border-top: 1px solid #c6c3bc; background: #f4f2ec; color: #56534d; font-size: 11px; }
.figma-variant .preview-table td { padding-top: 17px; padding-bottom: 17px; border-bottom-color: #d9d6ce; }
.figma-variant .preview-table tbody tr:hover { background: #f5f8ec; }
.figma-variant .preview-table tfoot th, .figma-variant .preview-table tfoot td { border-top: 1px solid var(--figma-rule); background: #f4f2ec; color: #171716; }
.figma-variant .material-ledger { border: 1px solid var(--figma-rule); border-radius: 0; }
.figma-variant .table-toolbar { border-bottom: 0; padding: 23px 25px; background: #dceeb1; }
.figma-variant .table-toolbar input, .figma-variant .table-toolbar select { background: #fff; border-color: #77796c; }
.figma-variant .table-summary { border-top: 1px solid var(--figma-rule); background: #f4f2ec; }
.figma-variant .material-type { display: inline-block; margin-top: 6px; padding: 1px 6px; background: #f0ede6; color: #56534d; }
.figma-variant .guidance-link { color: #171716; text-decoration: underline; text-underline-offset: 4px; }
.figma-variant .material-editor { border: 1px solid var(--figma-rule); background: #f4ecd6; padding: 0 25px 23px; }
.figma-variant .preview-content input, .figma-variant .preview-content select { min-height: 44px; border-color: #929087; border-radius: 0; }
.figma-variant .preview-field > span { color: #3f3c34; font-size: 13px; }
.figma-variant .project-form { max-width: none; padding: 0; border: 1px solid var(--figma-rule); border-radius: 0; background: #fff; }
.figma-variant .form-section { display: grid; grid-template-columns: 180px minmax(0, 1fr); gap: 32px; padding: 30px; }
.figma-variant .form-section + .form-section { margin-top: 0; border-top: 1px solid var(--figma-rule); background: #f4ecd6; }
.figma-variant .form-section > h2 { margin: 0; font-family: 'Preview Sans', var(--v-font); font-size: 24px; font-weight: 500; line-height: 1.5; }
.figma-variant .form-section .field-grid { gap: 24px; }
.figma-variant .project-form > .form-actions { margin: 0; padding: 24px 30px; border-top: 1px solid var(--figma-rule); }
.figma-variant .directory-project { position: relative; min-height: 215px; padding: 34px; border: 1px solid var(--figma-rule); border-radius: 0; background: #c5b0f4; }
.figma-variant .directory-project:hover { border-color: #171716; background: #d0bef7; }
.figma-variant .directory-icon { align-self: stretch; display: grid; place-items: center; width: 100px; flex-shrink: 0; border: 1px solid #171716; background: #dceeb1; color: #171716; }
.figma-variant .directory-icon svg { width: 36px; height: 36px; }
.figma-variant .directory-detail h2 { font-family: 'Preview Sans', var(--v-font); font-size: 28px; font-weight: 500; letter-spacing: -.035em; }
.figma-variant .directory-detail p, .figma-variant .directory-detail dt { color: #443959; }
.figma-variant .directory-detail dl { gap: 35px; }
.figma-variant .directory-open { align-self: flex-end; min-height: 42px; padding: 10px 16px; border-radius: 24px; background: #171716; color: #fff; }
.figma-variant.figma-login { display: block; background: #dceeb1; }
.figma-variant.figma-login .figma-main { max-width: none; padding: 0; }
.figma-variant .page-login { min-height: calc(100svh - var(--lab-toolbar-height, 96px)); padding: 48px 24px; }
.figma-variant .login-composition { width: min(100%, 600px); }
.figma-variant .login-brand { margin-bottom: 32px; }
.figma-variant .login-brand h1 { font-family: 'Preview Sans', var(--v-font); font-size: clamp(30px, 4vw, 48px); font-weight: 700; letter-spacing: -.04em; }
.figma-variant .login-brand p { color: #3f4931; }
.figma-variant .login-form { max-width: 440px; margin: 0 auto; padding: 30px; border: 1px solid var(--figma-rule); background: #fff; }
.figma-variant .login-form h2 { font-family: 'Preview Sans', var(--v-font); font-size: 25px; font-weight: 500; }
.figma-variant .login-return { color: #3f4931; }

@media (min-width: 1600px) {
  .figma-variant .figma-main { padding: 44px 50px; }
  .figma-variant .overview-grid { grid-template-columns: 330px minmax(0, 1fr); }
  .figma-variant .metric-cell { padding: 25px 32px; }
  .figma-variant .stage-panel { padding-inline: 30px; }
}
@media (max-width: 1100px) {
  .figma-variant { grid-template-columns: 106px minmax(0, 1fr); --v-title-size: 38px; }
  .figma-variant .figma-rail { padding-inline: 10px; }
  .figma-variant .figma-brand { font-size: 18px; }
  .figma-variant .figma-main { padding: 30px 26px; }
  .figma-variant .figma-project-bar { padding-inline: 26px; }
  .figma-variant .overview-grid { grid-template-columns: minmax(220px, .85fr) minmax(0, 1.4fr); }
  .figma-variant .metric-cell { padding: 20px; }
  .figma-variant .metric-cell:first-child strong { font-size: 32px; }
  .figma-variant .stage-panel { padding-inline: 0; }
  .figma-variant .project-summary { grid-template-columns: 140px minmax(0, 1fr); gap: 18px; padding: 24px; }
  .figma-variant .project-summary dl { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .figma-variant .form-section { grid-template-columns: 135px minmax(0, 1fr); gap: 22px; padding: 25px; }
  .figma-variant .directory-project { flex-wrap: wrap; padding: 28px; }
  .figma-variant .directory-icon { width: 76px; min-height: 115px; }
}
@media (max-width: 760px) {
  .figma-variant { display: block; --v-title-size: 36px; }
  .figma-variant .figma-rail { display: block; padding: 18px 20px 0; border-right: 0; border-bottom: 1px solid var(--figma-rule); }
  .figma-variant .figma-brand { display: flex; gap: 0; padding: 0; font-size: 19px; }
  .figma-variant .figma-navigation { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; margin-top: 20px; padding-bottom: 15px; }
  .figma-variant .figma-navigation button { flex-direction: row; min-height: 42px; gap: 6px; padding: 8px 4px; }
  .figma-variant .figma-navigation svg { width: 16px; height: 16px; }
  .figma-variant .figma-rail-note { display: none; }
  .figma-variant .figma-project-bar { min-height: 55px; gap: 12px; padding: 8px 20px; }
  .figma-variant .figma-project-name { padding-left: 12px; font-size: 11px; }
  .figma-variant .figma-back span { display: none; }
  .figma-variant .figma-back { width: 26px; flex-shrink: 0; }
  .figma-variant .figma-account { gap: 5px; font-size: 11px; }
  .figma-variant .figma-main { padding: 28px 20px 36px; }
  .figma-variant .content-heading { align-items: flex-start; flex-direction: column; gap: 22px; }
  .figma-variant .content-heading h1 { font-size: 36px; }
  .figma-variant .content-heading p { margin-top: 12px; }
  .figma-variant .heading-actions { justify-content: flex-start; }
  .figma-variant .overview-grid { grid-template-columns: minmax(0, 1fr); grid-template-areas: 'metrics' 'stages' 'ledger' 'summary'; }
  .figma-variant .metrics-strip { display: grid; grid-template-columns: 1fr 1fr; border-right: 0; }
  .figma-variant .metric-cell { padding: 22px; }
  .figma-variant .metric-cell:first-child { grid-column: 1 / -1; }
  .figma-variant .metric-cell:first-child strong { font-size: 42px; }
  .figma-variant .metric-cell:nth-child(3) { border-left: 1px solid var(--figma-rule); }
  .figma-variant .metric-cell > div { flex-wrap: wrap; gap: 4px 8px; margin: 7px 0 6px; }
  .figma-variant .metric-cell strong { font-size: 26px; }
  .figma-variant .stage-panel { border-top: 1px solid var(--figma-rule); padding: 6px 0 0; }
  .figma-variant .stage-panel .panel-heading { padding-bottom: 22px; }
  .figma-variant .panel-heading h2 { font-size: 17px; }
  .figma-variant .ledger-panel .panel-heading { padding: 20px; }
  .figma-variant .project-summary { display: block; padding: 22px; }
  .figma-variant .project-summary .panel-heading { margin-bottom: 20px; }
  .figma-variant .project-summary dl { gap: 20px; }
  .figma-variant .project-summary .calculation-note { margin-top: 20px; }
  .figma-variant .form-section { display: block; padding: 24px; }
  .figma-variant .form-section > h2 { margin-bottom: 22px; font-size: 22px; }
  .figma-variant .project-form > .form-actions { padding: 22px 24px; }
  .figma-variant .directory-project { padding: 24px; gap: 22px; }
  .figma-variant .directory-icon { min-height: 70px; width: 70px; align-self: flex-start; }
  .figma-variant .directory-detail { width: 100%; }
  .figma-variant .directory-detail h2 { font-size: 24px; }
  .figma-variant .directory-open { width: auto; margin-left: auto; }
}
@media (max-width: 420px) {
  .figma-variant .figma-rail { padding-inline: 14px; }
  .figma-variant .figma-navigation { gap: 4px; }
  .figma-variant .figma-navigation button { font-size: 11px; }
  .figma-variant .figma-navigation svg { display: none; }
  .figma-variant .figma-project-bar { padding-inline: 16px; }
  .figma-variant .figma-main { padding: 25px 16px 32px; }
  .figma-variant .content-heading h1 { font-size: 32px; }
  .figma-variant .metric-cell { padding: 19px 17px; }
  .figma-variant .metric-cell > span { font-size: 11px; }
  .figma-variant .metric-cell strong { font-size: 25px; }
  .figma-variant .metric-cell:first-child strong { font-size: 37px; }
  .figma-variant .metric-cell:nth-child(n+2) > div { flex-direction: column; align-items: flex-start; }
  .figma-variant .metric-cell small { font-size: 10px; }
  .figma-variant .metric-cell p { font-size: 10px; }
  .figma-variant .stage-label { font-size: 12px; }
  .figma-variant .stage-label strong { font-size: 13px; }
  .figma-variant .stage-label small { margin-left: 6px; width: 36px; font-size: 10px; }
  .figma-variant .ledger-panel .panel-heading { gap: 8px; padding-inline: 17px; }
  .figma-variant .ledger-panel .panel-heading h2 { font-size: 15px; }
  .figma-variant .table-toolbar { padding: 20px 17px; }
  .figma-variant .project-summary { padding: 20px 17px; }
  .figma-variant .form-section { padding: 22px 18px; }
  .figma-variant .project-form > .form-actions { padding: 20px 18px; }
  .figma-variant .page-login { padding: 36px 18px; }
  .figma-variant .login-form { padding: 25px 22px; }
  .figma-variant .login-brand h1 { font-size: 30px; }
}
</style>
