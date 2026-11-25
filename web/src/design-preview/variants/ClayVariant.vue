<script setup lang="ts">
import { ArrowLeft, User } from '@element-plus/icons-vue'
import PreviewContent from '../PreviewContent.vue'
import { usePreview } from '../state'
import type { PageId } from '../types'

defineProps<{ page: PageId }>()
const emit = defineEmits<{ navigate: [page: PageId] }>()
const state = usePreview()
const navigation = [
  { page: 'overview' as const, label: '项目概览' },
  { page: 'materials' as const, label: '建材清单' },
  { page: 'project' as const, label: '项目信息' },
]
</script>

<template>
  <div class="clay-variant" :class="{ 'clay-login': page === 'login' }">
    <template v-if="page !== 'login'">
      <header class="clay-header">
        <button class="clay-brand" @click="emit('navigate', 'projects')">碳建智算平台</button>
        <nav class="clay-navigation" aria-label="项目功能">
          <button v-for="item in navigation" :key="item.page" :class="{ active: page === item.page }" :aria-current="page === item.page ? 'page' : undefined" @click="emit('navigate', item.page)">{{ item.label }}</button>
        </nav>
        <button class="clay-account" @click="emit('navigate', 'login')"><User aria-hidden="true" /><span>登录页</span></button>
      </header>
      <div class="clay-project-path">
        <button @click="emit('navigate', 'projects')"><ArrowLeft aria-hidden="true" />项目目录</button>
        <span v-if="page !== 'projects'">{{ state.project.name }}</span>
      </div>
    </template>
    <main class="variant-body clay-canvas"><PreviewContent :page="page" @navigate="emit('navigate', $event)" /></main>
  </div>
</template>

<style>
.clay-variant {
  --v-bg: #fffaf0;
  --v-surface: #fffdf7;
  --v-text: #1a3a3a;
  --v-muted: #52625b;
  --v-line: #d7d9ca;
  --v-accent: #1a3a3a;
  --v-tint: #e7f0e9;
  --v-radius: 12px;
  --v-font: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  --v-title-size: 46px;
  --v-title-weight: 500;
  min-height: calc(100svh - var(--lab-toolbar-height, 96px));
  background: var(--v-bg);
  color: var(--v-text);
  font-family: var(--v-font);
}
.clay-variant ::selection { background: #b8a4ed; color: #1a3a3a; }
.clay-variant :is(button, a, input, select):focus-visible { outline: 3px solid #4e3883; outline-offset: 4px; }
.clay-variant .clay-header { display: flex; align-items: center; gap: 28px; min-height: 90px; max-width: 1384px; margin: auto; padding: 18px 48px; }
.clay-variant .clay-brand { padding: 0; border: 0; background: transparent; color: var(--v-text); font-family: "Preview Sans", var(--v-font); font-size: 23px; font-weight: 700; letter-spacing: -.03em; white-space: nowrap; }
.clay-variant .clay-navigation { display: flex; align-items: center; gap: 4px; margin: 0 auto; padding: 5px; border: 1px solid #d2d9cb; border-radius: 999px; }
.clay-variant .clay-navigation button { padding: 10px 22px; min-height: 40px; border: 0; border-radius: 999px; color: #405b53; background: transparent; font-size: 13px; white-space: nowrap; }
.clay-variant .clay-navigation button:hover { background: #e1ebdf; }
.clay-variant .clay-navigation button.active { background: #1a3a3a; color: #fffaf0; }
.clay-variant .clay-account { display: flex; align-items: center; gap: 7px; min-height: 44px; padding: 8px 0 8px 12px; border: 0; color: #1a3a3a; background: transparent; font-size: 13px; white-space: nowrap; }
.clay-variant .clay-account:hover { text-decoration: underline; text-underline-offset: 5px; }
.clay-variant .clay-project-path { display: flex; align-items: center; gap: 18px; max-width: 1384px; margin: auto; padding: 11px 48px 0; color: #52625b; font-size: 12px; }
.clay-variant .clay-project-path button { display: flex; flex-shrink: 0; align-items: center; gap: 7px; min-height: 32px; padding: 6px 0; border: 0; color: #52625b; background: transparent; }
.clay-variant .clay-project-path button:hover { color: #1a3a3a; }
.clay-variant .clay-project-path span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.clay-variant .clay-project-path svg { width: 15px; height: 15px; }
.clay-variant .clay-canvas { min-width: 0; max-width: 1384px; margin: auto; padding: 26px 48px 60px; }
.clay-variant .content-heading { align-items: flex-end; margin-bottom: 34px; }
.clay-variant .content-heading h1 { font-family: "Preview Sans", var(--v-font); font-size: var(--v-title-size); font-weight: 500; line-height: 1.25; letter-spacing: -.035em; }
.clay-variant .content-heading p { margin-top: 14px; font-size: 13px; color: #52625b; }
.clay-variant .heading-actions { padding-bottom: 2px; }
.clay-variant .primary-action, .clay-variant .secondary-action { min-height: 44px; border-radius: 12px; padding: 12px 20px; font-size: 13px; }
.clay-variant .primary-action { color: #fffaf0; background: #1a3a3a; }
.clay-variant .primary-action:hover { background: #294f49; }
.clay-variant .secondary-action { border-color: #afbbb0; background: transparent; }
.clay-variant .secondary-action:hover { border-color: #1a3a3a; background: #edf1e8; }
.clay-variant .overview-grid { grid-template-columns: minmax(0, .92fr) minmax(0, 1.08fr); grid-template-areas: "stages metrics" "stages summary" "ledger ledger"; gap: 20px; align-items: stretch; }
.clay-variant .metrics-strip { grid-area: metrics; grid-template-columns: repeat(2, minmax(0,1fr)); border: 0; border-radius: 16px; overflow: hidden; background: #ffbc96; }
.clay-variant .metric-cell { padding: 20px 28px; border: 0; }
.clay-variant .metric-cell:first-child { grid-column: 1 / -1; padding-top: 24px; padding-bottom: 19px; border-bottom: 1px solid #c99175; }
.clay-variant .metric-cell + .metric-cell { border-left: 0; }
.clay-variant .metric-cell:nth-child(3) { border-left: 1px solid #c99175; }
.clay-variant .metric-cell > span { color: #5b4a3b; font-size: 12px; }
.clay-variant .metric-cell > div { margin: 8px 0 7px; gap: 9px; }
.clay-variant .metric-cell strong { color: #253e36; font-family: "Preview Sans", var(--v-font); font-weight: 500; font-size: 29px; letter-spacing: -.04em; line-height: 1.15; }
.clay-variant .metric-cell:first-child strong { font-size: clamp(40px, 4vw, 54px); }
.clay-variant .metric-cell small, .clay-variant .metric-cell p { color: #5b4a3b; }
.clay-variant .metric-cell p { font-size: 11px; }
.clay-variant .stage-panel { grid-area: stages; display: flex; flex-direction: column; background: #1a3a3a; border: 0; border-radius: 16px; color: #fffaf0; }
.clay-variant .stage-panel .panel-heading { padding: 28px 30px 20px; }
.clay-variant .panel-heading h2 { font-family: "Preview Sans", var(--v-font); font-size: 18px; font-weight: 500; }
.clay-variant .stage-panel .panel-heading > span { color: #c3d7cc; }
.clay-variant .stage-bars { flex: 1; gap: 28px; padding: 22px 30px 32px; align-content: center; }
.clay-variant .stage-label { margin-bottom: 12px; font-size: 14px; }
.clay-variant .stage-label strong { font-size: 15px; }
.clay-variant .stage-label small { margin-left: 12px; color: #c3d7cc; font-size: 11px; }
.clay-variant .stage-track { height: 10px; background: #3d5b55; border-radius: 999px; }
.clay-variant .stage-fill { height: 10px; border-radius: 999px; background: #b8a4ed; }
.clay-variant .stage-fill.stage-1 { opacity: 1; background: #ffbc96; }
.clay-variant .stage-fill.stage-2 { opacity: 1; background: #a4d4c5; }
.clay-variant .recovery-line, .clay-variant .net-line { margin-inline: 30px; }
.clay-variant .recovery-line { border-color: #56756b; padding-block: 18px 15px; color: #c3d7cc; }
.clay-variant .net-line { gap: 20px; padding-bottom: 30px; flex-wrap: wrap; }
.clay-variant .net-line > span { color: #fffaf0; }
.clay-variant .net-line strong { font-family: "Preview Sans", var(--v-font); font-size: 26px; font-weight: 500; }
.clay-variant .net-line small { color: #c3d7cc; }
.clay-variant .project-summary { grid-area: summary; background: #d7e9de; border: 0; border-radius: 16px; }
.clay-variant .project-summary .panel-heading { padding: 18px 28px 14px; }
.clay-variant .project-summary dl { grid-template-columns: repeat(2, minmax(0,1fr)); gap: 15px 20px; padding: 0 28px 19px; }
.clay-variant .project-summary dl > div { display: block; }
.clay-variant .project-summary dt { font-size: 11px; color: #4d6157; margin-bottom: 3px; }
.clay-variant .project-summary dd { font-size: 13px; text-align: left; }
.clay-variant .project-summary .calculation-note { margin: 0 28px 22px; padding-top: 15px; border-color: #acc8b7; color: #4d6157; font-size: 11px; line-height: 1.7; }
.clay-variant .ledger-panel { grid-area: ledger; margin-top: 15px; border: 0; border-radius: 0; background: transparent; }
.clay-variant .ledger-panel .panel-heading { padding: 9px 0 23px; }
.clay-variant .ledger-panel .panel-heading h2 { font-size: 23px; }
.clay-variant .ledger-panel .table-scroll { border-top: 1px solid #aebaae; border-bottom: 1px solid #aebaae; }
.clay-variant .preview-table { font-size: 14px; }
.clay-variant .preview-table th { padding-top: 16px; padding-bottom: 16px; background: #edf0e5; color: #52625b; font-weight: 500; font-size: 12px; }
.clay-variant .preview-table td { padding-top: 17px; padding-bottom: 17px; }
.clay-variant .preview-table tbody tr:hover { background: #e8efe4; }
.clay-variant .preview-table tfoot td, .clay-variant .preview-table tfoot th { background: #fffaf0; font-size: 13px; }
.clay-variant .material-ledger { border: 0; border-radius: 16px; background: #fffdf7; }
.clay-variant .table-toolbar { background: #d7e9de; padding: 24px; border: 0; }
.clay-variant .table-toolbar input, .clay-variant .table-toolbar select { border-color: #788b7b; background: #fffdf7; }
.clay-variant .table-summary { background: #f0f2e9; border-color: #d7d9ca; }
.clay-variant .text-action { color: #1a3a3a; font-size: 13px; }
.clay-variant .text-action:hover { background: #d9e5d5; }
.clay-variant .material-type { display: inline-block; padding: 2px 7px; margin-top: 5px; border-radius: 4px; color: #486056; background: #e4eee5; }
.clay-variant .guidance-link { color: #1a3a3a; text-decoration: underline; text-underline-offset: 4px; }
.clay-variant .preview-content input, .clay-variant .preview-content select { border-color: #788b7b; border-radius: 8px; min-height: 44px; }
.clay-variant .preview-content input:read-only { background: #e8eee3; }
.clay-variant .material-editor { background: #e9e1f5; border: 0; padding: 0 28px 26px; border-radius: 16px; }
.clay-variant .material-editor .panel-heading { padding-top: 24px; }
.clay-variant .material-editor .form-actions { border-color: #beb0d2; }
.clay-variant .project-form { display: grid; grid-template-columns: minmax(0,1.5fr) minmax(240px,.8fr); gap: 28px 40px; max-width: none; padding: 0; border: 0; border-radius: 0; background: transparent; }
.clay-variant .form-section { padding: 28px 30px; background: #fffdf7; border-radius: 16px; }
.clay-variant .form-section + .form-section { margin-top: 0; background: #d7e9de; align-self: start; }
.clay-variant .form-section h2 { font-family: "Preview Sans", var(--v-font); font-size: 21px; font-weight: 500; margin-bottom: 25px; }
.clay-variant .project-form .field-grid { gap: 25px 22px; }
.clay-variant .project-form .form-actions { grid-column: 1 / -1; margin-top: 0; padding-top: 0; border-top: 0; }
.clay-variant .preview-field > span { color: #405b53; font-size: 13px; }
.clay-variant .preview-field small { font-size: 12px; }
.clay-variant .directory-project { padding: 35px; border: 0; border-radius: 16px; background: #ffbc96; gap: 28px; }
.clay-variant .directory-project:hover { background: #f6ad85; }
.clay-variant .directory-icon { flex-shrink: 0; display: grid; place-items: center; width: 64px; height: 64px; border-radius: 16px; background: #1a3a3a; color: #ffbc96; }
.clay-variant .directory-detail h2 { font-family: "Preview Sans", var(--v-font); font-weight: 500; font-size: 26px; }
.clay-variant .directory-detail p, .clay-variant .directory-detail dt { color: #5b4a3b; }
.clay-variant .directory-detail dl { gap: 36px; }
.clay-variant .directory-open { padding: 12px 18px; border-radius: 12px; color: #fffaf0; background: #1a3a3a; }
.clay-variant .empty-state { padding-block: 54px; }
.clay-variant .empty-state h2 { font-family: "Preview Sans", var(--v-font); font-weight: 500; font-size: 22px; }
.clay-variant .page-note { max-width: 72ch; line-height: 1.8; }
.clay-variant.clay-login { background: #1a3a3a; }
.clay-variant.clay-login .clay-canvas { max-width: none; padding: 0; }
.clay-variant .page-login { min-height: calc(100svh - var(--lab-toolbar-height, 96px)); padding: 48px 24px; }
.clay-variant .login-composition { width: min(100%, 480px); }
.clay-variant .login-brand h1 { font-family: "Preview Sans", var(--v-font); color: #fffaf0; font-size: 42px; font-weight: 500; }
.clay-variant .login-brand p { color: #c3d7cc; }
.clay-variant .login-form { padding: 34px 36px; border: 0; border-radius: 16px; background: #d7e9de; }
.clay-variant .login-form h2 { font-family: "Preview Sans", var(--v-font); color: #1a3a3a; font-size: 26px; font-weight: 500; }
.clay-variant .login-form > p { color: #4d6157; }
.clay-variant .login-form .primary-action { color: #1a3a3a; background: #b8a4ed; font-weight: 600; }
.clay-variant .login-form .primary-action:hover { background: #a58cde; }
.clay-variant .login-return { color: #c3d7cc; }
.clay-variant .login-return:focus-visible { outline-color: #b8a4ed; }
@media (max-width: 1100px) {
  .clay-variant .clay-header { gap: 18px; padding-inline: 30px; }
  .clay-variant .clay-navigation button { padding-inline: 16px; }
  .clay-variant .clay-project-path { padding-inline: 30px; }
  .clay-variant .clay-canvas { padding-inline: 30px; }
  .clay-variant .overview-grid { grid-template-columns: minmax(0,1fr) minmax(0,1.1fr); gap: 16px; }
  .clay-variant .metric-cell { padding-inline: 20px; }
  .clay-variant .metric-cell strong { font-size: 26px; }
  .clay-variant .metric-cell > div { gap: 6px; }
  .clay-variant .project-form { grid-template-columns: minmax(0,1fr); gap: 24px; }
  .clay-variant .form-section + .form-section { max-width: none; }
}
@media (max-width: 800px) {
  .clay-variant { --v-title-size: 38px; }
  .clay-variant .clay-header { flex-wrap: wrap; gap: 15px; padding: 20px 24px 12px; }
  .clay-variant .clay-brand { font-size: 21px; }
  .clay-variant .clay-account { margin-left: auto; }
  .clay-variant .clay-navigation { order: 3; width: 100%; margin: 0; }
  .clay-variant .clay-navigation button { flex: 1; padding-inline: 10px; }
  .clay-variant .clay-project-path { padding: 12px 24px 0; }
  .clay-variant .clay-canvas { padding: 24px 24px 40px; }
  .clay-variant .content-heading { align-items: flex-start; gap: 20px; }
  .clay-variant .heading-actions { flex-wrap: wrap; justify-content: flex-end; }
  .clay-variant .overview-grid { grid-template-columns: minmax(0,1fr); grid-template-areas: "metrics" "stages" "summary" "ledger"; }
  .clay-variant .metrics-strip { grid-template-columns: minmax(0,1.2fr) minmax(0,1fr) minmax(0,1fr); }
  .clay-variant .metric-cell:first-child { grid-column: auto; border-bottom: 0; padding: 22px 20px; }
  .clay-variant .metric-cell + .metric-cell { border-left: 1px solid #c99175; }
  .clay-variant .metric-cell { padding: 22px 20px; }
  .clay-variant .metric-cell:first-child strong { font-size: 34px; }
  .clay-variant .metric-cell > div { flex-direction: column; gap: 5px; }
  .clay-variant .stage-bars { padding-top: 12px; gap: 25px; }
  .clay-variant .directory-project { gap: 20px; padding: 28px; flex-wrap: wrap; }
  .clay-variant .directory-open { margin-left: 84px; }
}
@media (max-width: 640px) {
  .clay-variant { --v-title-size: 34px; }
  .clay-variant .clay-header { padding-inline: 18px; }
  .clay-variant .clay-project-path { padding-inline: 18px; font-size: 11px; gap: 14px; }
  .clay-variant .clay-canvas { padding: 22px 18px 36px; }
  .clay-variant .content-heading { flex-direction: column; margin-bottom: 28px; }
  .clay-variant .content-heading h1 { font-size: 34px; }
  .clay-variant .content-heading p { margin-top: 11px; }
  .clay-variant .heading-actions { justify-content: flex-start; }
  .clay-variant .metrics-strip { grid-template-columns: repeat(2,minmax(0,1fr)); }
  .clay-variant .metric-cell { display: block; padding: 20px; }
  .clay-variant .metric-cell:first-child { grid-column: 1 / -1; border-bottom: 1px solid #c99175; padding: 22px 24px; }
  .clay-variant .metric-cell + .metric-cell { border: 0; }
  .clay-variant .metric-cell:nth-child(3) { border-left: 1px solid #c99175; }
  .clay-variant .metric-cell > div { display: flex; flex-direction: row; justify-content: flex-start; align-items: baseline; gap: 6px; margin-block: 8px; }
  .clay-variant .metric-cell p { max-width: none; font-size: 10px; }
  .clay-variant .metric-cell > span { font-size: 11px; }
  .clay-variant .metric-cell small { font-size: 10px; }
  .clay-variant .metric-cell strong { font-size: 26px; }
  .clay-variant .metric-cell:first-child strong { font-size: 44px; }
  .clay-variant .stage-panel .panel-heading { padding: 23px 22px 16px; }
  .clay-variant .stage-bars { padding: 12px 22px 28px; }
  .clay-variant .stage-label { font-size: 12px; }
  .clay-variant .stage-label strong { font-size: 13px; }
  .clay-variant .stage-label small { margin-left: 7px; font-size: 10px; width: 37px; }
  .clay-variant .recovery-line, .clay-variant .net-line { margin-inline: 22px; font-size: 11px; }
  .clay-variant .net-line { gap: 8px; padding-bottom: 24px; }
  .clay-variant .net-line strong { font-size: 23px; }
  .clay-variant .project-summary .panel-heading { padding: 18px 22px 14px; }
  .clay-variant .project-summary dl { padding-inline: 22px; gap: 15px; }
  .clay-variant .project-summary .calculation-note { margin-inline: 22px; }
  .clay-variant .ledger-panel .panel-heading h2 { font-size: 19px; }
  .clay-variant .ledger-panel .panel-heading { gap: 8px; }
  .clay-variant .ledger-panel .text-action { font-size: 12px; gap: 4px; }
  .clay-variant .table-toolbar { padding: 18px; }
  .clay-variant .form-section { padding: 24px 22px; }
  .clay-variant .project-form .field-grid { grid-template-columns: minmax(0,1fr); }
  .clay-variant .material-editor { padding: 0 22px 24px; }
  .clay-variant .directory-project { padding: 24px; gap: 18px; }
  .clay-variant .directory-icon { width: 44px; height: 44px; border-radius: 12px; }
  .clay-variant .directory-detail { width: calc(100% - 62px); }
  .clay-variant .directory-detail h2 { font-size: 20px; }
  .clay-variant .directory-detail dl { gap: 18px; }
  .clay-variant .directory-open { width: auto; margin-left: 62px; margin-top: 2px; }
  .clay-variant .login-brand h1 { font-size: 32px; }
  .clay-variant .page-login { padding: 36px 20px; }
  .clay-variant .login-form { padding: 28px 24px; }
}
@media (max-width: 360px) {
  .clay-variant .clay-canvas { padding-inline: 14px; }
  .clay-variant .clay-header, .clay-variant .clay-project-path { padding-inline: 14px; }
  .clay-variant .clay-brand { font-size: 19px; }
  .clay-variant .clay-navigation button { font-size: 12px; padding-inline: 7px; }
  .clay-variant .metric-cell { padding-inline: 16px; }
  .clay-variant .metric-cell strong { font-size: 24px; }
  .clay-variant .metric-cell:first-child strong { font-size: 40px; }
  .clay-variant .directory-project { padding: 22px 18px; }
  .clay-variant .directory-detail { width: 100%; }
  .clay-variant .directory-open { margin-left: 0; }
  .clay-variant .login-brand h1 { font-size: 29px; }
}
</style>
