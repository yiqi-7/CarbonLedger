<script setup lang="ts">
import { ArrowRight, User } from '@element-plus/icons-vue'
import PreviewContent from '../PreviewContent.vue'
import type { PageId } from '../types'

defineProps<{ page: PageId }>()
const emit = defineEmits<{ navigate: [page: PageId] }>()
const navigation = [
  { page: 'overview' as const, label: '项目概览' },
  { page: 'materials' as const, label: '建材清单' },
  { page: 'project' as const, label: '项目信息' },
  { page: 'projects' as const, label: '项目目录' },
]
</script>

<template>
  <div class="oura-variant" :class="{ 'oura-login': page === 'login' }">
    <header v-if="page !== 'login'" class="oura-header">
      <button class="oura-brand" @click="emit('navigate', 'projects')">碳建智算平台</button>
      <nav class="oura-navigation" aria-label="项目功能">
        <button v-for="item in navigation" :key="item.page" :aria-current="page === item.page ? 'page' : undefined" :class="{ active: page === item.page }" @click="emit('navigate', item.page)">{{ item.label }}</button>
      </nav>
      <button class="oura-account" @click="emit('navigate', 'login')"><User aria-hidden="true" /><span>登录</span><ArrowRight aria-hidden="true" /></button>
    </header>
    <main class="variant-body oura-main"><PreviewContent :page="page" @navigate="emit('navigate', $event)" /></main>
  </div>
</template>

<style>
.oura-variant {
  --v-bg: #f7f1e8;
  --v-surface: #fbf7f0;
  --v-text: #392b24;
  --v-muted: #716255;
  --v-line: #d8cdbd;
  --v-accent: #28593b;
  --v-tint: #e4e8d9;
  --v-radius: 6px;
  --v-font: 'Preview Sans', 'Segoe UI', 'Microsoft YaHei', sans-serif;
  --v-title-weight: 400;
  --v-title-size: 46px;
  min-height: calc(100svh - var(--lab-toolbar-height, 96px));
  background: var(--v-bg);
  color: var(--v-text);
  font-family: var(--v-font);
}
.oura-variant .oura-header { display: flex; align-items: center; gap: 32px; max-width: 1440px; margin: 0 auto; padding: 27px 48px; border-bottom: 1px solid var(--v-line); }
.oura-variant .oura-brand { padding: 0; border: 0; background: none; color: #392b24; font-family: 'Preview Serif', 'Songti SC', serif; font-size: 23px; font-weight: 600; white-space: nowrap; }
.oura-variant .oura-navigation { display: flex; gap: 27px; margin-left: auto; }
.oura-variant .oura-navigation button { position: relative; padding: 10px 0; border: 0; border-bottom: 1px solid transparent; background: none; color: #716255; font-size: 13px; white-space: nowrap; }
.oura-variant .oura-navigation button.active { border-bottom-color: #392b24; color: #392b24; }
.oura-variant .oura-navigation button:hover { color: #28593b; }
.oura-variant .oura-account { display: flex; align-items: center; gap: 8px; min-height: 40px; padding: 9px 0 9px 26px; border: 0; border-left: 1px solid var(--v-line); color: #392b24; background: none; font-size: 12px; }
.oura-variant .oura-account svg { width: 15px; height: 15px; }
.oura-variant .oura-main { max-width: 1440px; margin: 0 auto; padding: 40px 48px 64px; }
.oura-variant .content-heading { align-items: flex-end; margin-bottom: 38px; }
.oura-variant .content-heading h1 { font-family: 'Preview Serif', 'Songti SC', serif; font-weight: 400; font-size: var(--v-title-size); line-height: 1.3; letter-spacing: -.025em; }
.oura-variant .content-heading p { margin-top: 13px; font-size: 13px; }
.oura-variant .heading-actions { padding-bottom: 4px; }
.oura-variant .primary-action, .oura-variant .secondary-action { min-height: 42px; border-radius: 999px; padding-inline: 21px; }
.oura-variant .secondary-action { border-color: #a89c8a; background: transparent; }
.oura-variant .primary-action { background: #28593b; color: #fff; }
.oura-variant .primary-action:hover { background: #1c432b; }
.oura-variant .secondary-action:hover { background: #eee6d9; border-color: #716255; }
.oura-variant .overview-grid { grid-template-columns: minmax(230px, .7fr) minmax(0, 1.6fr); grid-template-areas: 'metrics stage' 'metrics summary' 'ledger ledger'; gap: 30px 48px; align-items: start; }
.oura-variant .metrics-strip { grid-area: metrics; display: grid; grid-template-columns: 1fr; border: 0; border-radius: 0; background: transparent; }
.oura-variant .metric-cell { display: block; min-height: 152px; padding: 8px 0 25px; }
.oura-variant .metric-cell + .metric-cell { padding-top: 25px; border-left: 0; border-top: 1px solid var(--v-line); }
.oura-variant .metric-cell > span { font-size: 13px; }
.oura-variant .metric-cell > div { display: flex; flex-direction: row; align-items: baseline; flex-wrap: wrap; gap: 10px; margin: 12px 0 9px; }
.oura-variant .metric-cell strong { color: #49342b; font-family: 'Preview Serif', Georgia, serif; font-size: clamp(32px, 3.3vw, 46px); font-weight: 400; line-height: 1.2; letter-spacing: -.03em; }
.oura-variant .metric-cell small { font-size: 11px; }
.oura-variant .metric-cell p { max-width: none; font-size: 12px; }
.oura-variant .stage-panel { grid-area: stage; border: 0; border-radius: 2px; background: #e4e8d9; }
.oura-variant .stage-panel .panel-heading { padding: 25px 30px 23px; }
.oura-variant .panel-heading h2 { font-family: 'Preview Serif', 'Songti SC', serif; font-size: 22px; font-weight: 600; }
.oura-variant .stage-bars { padding: 0 30px 24px; gap: 22px; }
.oura-variant .stage-label { font-size: 13px; }
.oura-variant .stage-label strong { color: #34492f; }
.oura-variant .stage-track { height: 5px; background: #cbd3bf; }
.oura-variant .stage-fill { background: #5b7156; }
.oura-variant .stage-1 { background: #8b704f; opacity: 1; }
.oura-variant .stage-2 { background: #917168; opacity: 1; }
.oura-variant .recovery-line, .oura-variant .net-line { margin-inline: 30px; }
.oura-variant .recovery-line { border-color: #bfc9b3; }
.oura-variant .net-line { padding-bottom: 24px; }
.oura-variant .net-line strong { color: #34492f; font-family: 'Preview Serif', Georgia, serif; font-size: 24px; font-weight: 600; }
.oura-variant .project-summary { grid-area: summary; padding-top: 18px; border: 0; border-top: 1px solid var(--v-line); border-radius: 0; background: transparent; }
.oura-variant .project-summary .panel-heading { padding: 0 0 20px; }
.oura-variant .project-summary dl { grid-template-columns: repeat(2, minmax(0,1fr)); gap: 18px 28px; padding: 0; }
.oura-variant .project-summary dl > div { display: block; font-size: 12px; }
.oura-variant .project-summary dt { margin-bottom: 6px; font-size: 11px; }
.oura-variant .project-summary dd { text-align: left; }
.oura-variant .project-summary .calculation-note { margin: 20px 0 0; padding-top: 14px; line-height: 1.8; font-size: 11px; }
.oura-variant .ledger-panel { grid-area: ledger; border: 0; border-top: 1px solid #b5a590; border-radius: 0; background: transparent; }
.oura-variant .ledger-panel .panel-heading { padding: 28px 0 22px; }
.oura-variant .preview-table { font-size: 13px; }
.oura-variant .preview-table th { background: #eae2d6; color: #655443; font-weight: 500; }
.oura-variant .preview-table th, .oura-variant .preview-table td { padding: 16px 18px; }
.oura-variant .preview-table tbody tr:hover { background: #eee7db; }
.oura-variant .preview-table tfoot td, .oura-variant .preview-table tfoot th { padding-top: 18px; background: transparent; }
.oura-variant .material-ledger { border: 0; border-top: 1px solid #b5a590; background: transparent; border-radius: 0; }
.oura-variant .table-toolbar { padding: 24px 0; border: 0; }
.oura-variant .table-summary { padding: 20px 0; }
.oura-variant .material-editor { border: 1px solid #b5a590; border-radius: 6px; background: #fdfaf4; padding-inline: 28px; }
.oura-variant .preview-content input, .oura-variant .preview-content select { border-color: #8b7c68; background: #fdfaf4; }
.oura-variant .project-form { max-width: none; border: 0; border-top: 1px solid #b5a590; padding: 28px 0 0; background: transparent; }
.oura-variant .form-section { display: grid; grid-template-columns: 210px minmax(0,1fr); gap: 35px; }
.oura-variant .form-section + .form-section { padding-top: 28px; border-top: 1px solid var(--v-line); }
.oura-variant .form-section h2 { font-family: 'Preview Serif', 'Songti SC', serif; font-size: 24px; font-weight: 400; }
.oura-variant .field-grid { column-gap: 30px; }
.oura-variant .directory-project { padding: 32px 0; border: 0; border-top: 1px solid #b5a590; border-bottom: 1px solid var(--v-line); border-radius: 0; background: transparent; }
.oura-variant .directory-project:hover { background: #eee7db; }
.oura-variant .directory-icon { align-self: flex-start; color: #716255; padding-top: 5px; }
.oura-variant .directory-detail h2 { font-family: 'Preview Serif', 'Songti SC', serif; font-size: 28px; font-weight: 400; }
.oura-variant .directory-open { color: #28593b; }
.oura-variant.oura-login .oura-main { max-width: none; padding: 0; }
.oura-variant .page-login { min-height: calc(100svh - var(--lab-toolbar-height, 96px)); padding: 48px 24px; }
.oura-variant .login-composition { width: min(100%, 460px); }
.oura-variant .login-brand h1 { font-family: 'Preview Serif', 'Songti SC', serif; font-size: clamp(30px, 3.8vw, 48px); font-weight: 400; }
.oura-variant .login-form { border: 0; border-top: 1px solid #b5a590; border-bottom: 1px solid #b5a590; border-radius: 0; padding: 30px 0; background: transparent; }
.oura-variant .login-form h2 { font-family: 'Preview Serif', 'Songti SC', serif; font-size: 26px; font-weight: 400; }
.oura-variant :is(button,a,input,select):focus-visible { outline: 2px solid #28593b; outline-offset: 4px; }
@media (max-width: 1050px) {
  .oura-variant .oura-header { gap: 22px; padding-inline: 30px; }
  .oura-variant .oura-navigation { gap: 20px; }
  .oura-variant .oura-main { padding: 32px 30px 48px; }
  .oura-variant .overview-grid { column-gap: 30px; grid-template-columns: 250px minmax(0,1fr); }
  .oura-variant .form-section { grid-template-columns: 155px minmax(0,1fr); gap: 24px; }
}
@media (max-width: 760px) {
  .oura-variant { --v-title-size: 36px; }
  .oura-variant .oura-header { flex-wrap: wrap; gap: 18px; padding: 20px 22px 0; }
  .oura-variant .oura-brand { font-size: 21px; }
  .oura-variant .oura-account { margin-left: auto; padding-left: 0; border-left: 0; }
  .oura-variant .oura-account > svg:first-child { display: none; }
  .oura-variant .oura-navigation { order: 3; justify-content: space-between; width: 100%; margin: 0; gap: 10px; }
  .oura-variant .oura-navigation button { padding-block: 12px 16px; min-height: 44px; font-size: 12px; }
  .oura-variant .oura-main { padding: 30px 22px 42px; }
  .oura-variant .content-heading { align-items: flex-start; flex-direction: column; gap: 21px; margin-bottom: 28px; }
  .oura-variant .overview-grid { grid-template-columns: minmax(0,1fr); grid-template-areas: 'metrics' 'stage' 'summary' 'ledger'; gap: 28px; }
  .oura-variant .metrics-strip { grid-template-columns: repeat(3, minmax(0,1fr)); }
  .oura-variant .metric-cell { min-height: 0; padding: 0 16px; }
  .oura-variant .metric-cell:first-child { padding-left: 0; }
  .oura-variant .metric-cell:last-child { padding-right: 0; }
  .oura-variant .metric-cell + .metric-cell { border-top: 0; border-left: 1px solid var(--v-line); padding-top: 0; }
  .oura-variant .metric-cell strong { font-size: 29px; }
  .oura-variant .metric-cell > div { display: block; }
  .oura-variant .metric-cell small { display: block; margin-top: 7px; }
  .oura-variant .metric-cell p { font-size: 11px; }
  .oura-variant .form-section { display: block; }
  .oura-variant .form-section h2 { margin-bottom: 24px; }
  .oura-variant .directory-detail h2 { font-size: 23px; }
}
@media (max-width: 540px) {
  .oura-variant .oura-main { padding-inline: 20px; }
  .oura-variant .metrics-strip { grid-template-columns: minmax(0,1fr); }
  .oura-variant .metric-cell { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 8px 14px; padding: 19px 0; }
  .oura-variant .metric-cell + .metric-cell { padding-top: 19px; border-left: 0; border-top: 1px solid var(--v-line); }
  .oura-variant .metric-cell > div { grid-column: 2; grid-row: 1 / 3; margin: 0; text-align: right; }
  .oura-variant .metric-cell > span { align-self: end; font-size: 12px; }
  .oura-variant .metric-cell p { grid-column: 1; max-width: 16ch; }
  .oura-variant .metric-cell strong { font-size: 32px; }
  .oura-variant .metric-cell small { margin-top: 4px; }
  .oura-variant .stage-panel .panel-heading { padding: 22px 20px; }
  .oura-variant .stage-bars { padding-inline: 20px; }
  .oura-variant .recovery-line, .oura-variant .net-line { margin-inline: 20px; }
  .oura-variant .project-summary dl { gap: 18px; }
  .oura-variant .panel-heading h2 { font-size: 20px; }
  .oura-variant .primary-action, .oura-variant .secondary-action { padding-inline: 16px; }
  .oura-variant .material-editor { padding-inline: 20px; }
  .oura-variant .directory-project { gap: 12px; }
}
</style>
