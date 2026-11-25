<script setup lang="ts">
import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'
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
  <div class="wired-variant" :class="{ 'wired-login': page === 'login' }">
    <header v-if="page !== 'login'" class="wired-header">
      <div class="wired-masthead">
        <button class="wired-directory" @click="emit('navigate', 'projects')"><ArrowLeft aria-hidden="true" /><span>我的项目</span></button>
        <button class="wired-brand" @click="emit('navigate', 'overview')">碳建智算平台</button>
        <button class="wired-account" @click="emit('navigate', 'login')">登录<ArrowRight aria-hidden="true" /></button>
      </div>
      <nav class="wired-navigation" aria-label="项目功能">
        <button v-for="item in navigation" :key="item.page" :aria-current="page === item.page ? 'page' : undefined" :class="{ active: page === item.page }" @click="emit('navigate', item.page)">{{ item.label }}</button>
        <span class="wired-scope">建筑工程 · 建造阶段</span>
      </nav>
    </header>
    <main class="variant-body wired-main"><PreviewContent :page="page" @navigate="emit('navigate', $event)" /></main>
  </div>
</template>

<style>
.wired-variant {
  --v-bg: #fff;
  --v-surface: #fff;
  --v-text: #121212;
  --v-muted: #606060;
  --v-line: #d8d8d8;
  --v-accent: #125c85;
  --v-tint: #f0f3f5;
  --v-radius: 0px;
  --v-font: 'Preview Sans', 'Segoe UI', 'Microsoft YaHei', sans-serif;
  --v-title-weight: 600;
  --v-title-size: 46px;
  min-height: calc(100svh - var(--lab-toolbar-height, 96px));
  color: var(--v-text);
  background: var(--v-bg);
  font-family: var(--v-font);
}
.wired-variant .wired-header { max-width: 1440px; margin: 0 auto; padding: 0 44px; }
.wired-variant .wired-masthead { display: grid; grid-template-columns: 1fr auto 1fr; gap: 24px; align-items: center; min-height: 108px; }
.wired-variant .wired-brand { border: 0; padding: 10px 0; color: #121212; background: none; font-family: 'Preview Serif', 'Songti SC', serif; font-size: 36px; font-weight: 700; letter-spacing: .02em; white-space: nowrap; }
.wired-variant .wired-directory, .wired-variant .wired-account { display: flex; align-items: center; gap: 8px; width: max-content; min-height: 44px; padding: 8px 0; border: 0; background: none; color: #121212; font-size: 12px; }
.wired-variant .wired-account { justify-self: end; }
.wired-variant .wired-directory:hover, .wired-variant .wired-account:hover { color: #125c85; text-decoration: underline; text-underline-offset: 5px; }
.wired-variant .wired-navigation { display: flex; align-items: center; gap: 0; border-top: 3px solid #121212; border-bottom: 1px solid #121212; }
.wired-variant .wired-navigation button { min-height: 48px; padding: 12px 23px; border: 0; border-right: 1px solid #d8d8d8; color: #404040; background: transparent; font-size: 13px; }
.wired-variant .wired-navigation button:first-child { border-left: 1px solid #d8d8d8; }
.wired-variant .wired-navigation button.active { color: #fff; background: #121212; }
.wired-variant .wired-navigation button:hover:not(.active) { background: #ededed; }
.wired-variant .wired-scope { margin-left: auto; padding-left: 20px; color: #606060; font-size: 11px; }
.wired-variant .wired-main { max-width: 1440px; margin: 0 auto; padding: 32px 44px 60px; }
.wired-variant .content-heading { align-items: flex-end; padding-bottom: 28px; margin-bottom: 0; border-bottom: 1px solid #121212; }
.wired-variant .content-heading h1 { font-family: 'Preview Serif', 'Songti SC', serif; font-size: var(--v-title-size); font-weight: 600; line-height: 1.25; letter-spacing: -.025em; }
.wired-variant .content-heading p { font-size: 12px; margin-top: 12px; }
.wired-variant .primary-action { min-height: 42px; padding-inline: 19px; color: #fff; background: #121212; border-color: #121212; }
.wired-variant .primary-action:hover { background: #333; }
.wired-variant .secondary-action { min-height: 42px; padding-inline: 19px; border-color: #121212; background: #fff; }
.wired-variant .secondary-action:hover { background: #f0f0f0; }
.wired-variant .overview-grid { grid-template-columns: minmax(0, 1.7fr) minmax(320px,1fr); grid-template-areas: 'metrics metrics' 'ledger stage' 'summary summary'; gap: 30px 34px; align-items: start; }
.wired-variant .metrics-strip { grid-area: metrics; border: 0; border-bottom: 1px solid #121212; border-radius: 0; background: transparent; }
.wired-variant .metric-cell { padding: 22px 26px 23px; }
.wired-variant .metric-cell:first-child { padding-left: 0; }
.wired-variant .metric-cell:last-child { padding-right: 0; }
.wired-variant .metric-cell > span { font-size: 12px; }
.wired-variant .metric-cell strong { font-family: 'Preview Serif', Georgia, serif; font-size: clamp(30px, 3vw, 42px); font-weight: 600; line-height: 1.2; letter-spacing: -.03em; }
.wired-variant .metric-cell > div { margin-block: 10px 7px; }
.wired-variant .metric-cell p { font-size: 11px; }
.wired-variant .panel-heading { padding: 0 0 20px; }
.wired-variant .panel-heading h2 { font-family: 'Preview Serif', 'Songti SC', serif; font-size: 22px; font-weight: 600; }
.wired-variant .ledger-panel { grid-area: ledger; border: 0; border-radius: 0; background: none; }
.wired-variant .preview-table { font-size: 13px; }
.wired-variant .preview-table th { color: #404040; background: #f2f2f2; border-top: 1px solid #121212; border-bottom: 1px solid #121212; font-weight: 500; }
.wired-variant .preview-table th, .wired-variant .preview-table td { padding: 17px 12px; }
.wired-variant .preview-table th:first-child, .wired-variant .preview-table td:first-child { padding-left: 12px; }
.wired-variant .preview-table th:last-child, .wired-variant .preview-table td:last-child { padding-right: 12px; }
.wired-variant .preview-table tbody tr:hover { background: #f6f6f6; }
.wired-variant .preview-table tfoot th, .wired-variant .preview-table tfoot td { border-top: 1px solid #121212; background: #fff; }
.wired-variant .stage-panel { grid-area: stage; padding-left: 28px; border: 0; border-left: 1px solid #bcbcbc; border-radius: 0; background: none; }
.wired-variant .stage-bars { padding: 2px 0 24px; gap: 22px; }
.wired-variant .stage-label { font-size: 12px; }
.wired-variant .stage-label small { width: 38px; margin-left: 10px; }
.wired-variant .stage-track { height: 5px; background: #e8e8e8; }
.wired-variant .stage-fill { background: #121212; }
.wired-variant .stage-1 { background: #606060; opacity: 1; }
.wired-variant .stage-2 { background: #969696; opacity: 1; }
.wired-variant .recovery-line, .wired-variant .net-line { margin-inline: 0; }
.wired-variant .net-line strong { font-family: 'Preview Serif', Georgia, serif; font-weight: 600; font-size: 23px; }
.wired-variant .project-summary { grid-area: summary; border: 0; border-top: 1px solid #121212; border-bottom: 1px solid #121212; border-radius: 0; padding: 24px 0; background: none; }
.wired-variant .project-summary .panel-heading { padding-bottom: 20px; }
.wired-variant .project-summary dl { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 24px; padding: 0; }
.wired-variant .project-summary dl > div { display: block; }
.wired-variant .project-summary dt { color: #606060; font-size: 11px; margin-bottom: 8px; }
.wired-variant .project-summary dd { text-align: left; font-size: 13px; }
.wired-variant .project-summary .calculation-note { margin: 22px 0 0; padding-top: 16px; font-size: 11px; }
.wired-variant .material-ledger { margin-top: 24px; border: 0; border-radius: 0; }
.wired-variant .table-toolbar { padding: 0 0 22px; border: 0; }
.wired-variant .table-summary { padding: 17px 0; border-top-color: #121212; }
.wired-variant .material-editor { margin-top: 24px; border-color: #121212; padding: 24px; }
.wired-variant .material-editor .panel-heading { padding-bottom: 24px; }
.wired-variant .preview-content input, .wired-variant .preview-content select { border-color: #8b8b8b; border-radius: 0; }
.wired-variant .project-form { max-width: none; border: 0; padding: 28px 0 0; }
.wired-variant .form-section { display: grid; grid-template-columns: 210px minmax(0,1fr); gap: 38px; }
.wired-variant .form-section h2 { font-family: 'Preview Serif', 'Songti SC', serif; font-size: 26px; font-weight: 600; }
.wired-variant .form-section + .form-section { border-top: 1px solid #121212; padding-top: 30px; }
.wired-variant .form-actions { border-top-color: #121212; padding-top: 24px; }
.wired-variant .directory-project { border: 0; border-bottom: 1px solid #121212; border-radius: 0; padding: 30px 0; background: transparent; }
.wired-variant .directory-project:hover { background: #f5f5f5; }
.wired-variant .directory-icon { display: none; }
.wired-variant .directory-detail h2 { font-family: 'Preview Serif', 'Songti SC', serif; font-size: 30px; font-weight: 600; }
.wired-variant .directory-detail dl { gap: 64px; }
.wired-variant .directory-open { color: #125c85; }
.wired-variant.wired-login .wired-main { padding: 0; max-width: none; }
.wired-variant .page-login { min-height: calc(100svh - var(--lab-toolbar-height, 96px)); padding: 48px 24px; }
.wired-variant .login-composition { width: min(100%, 440px); }
.wired-variant .login-brand { padding-bottom: 28px; margin-bottom: 0; border-bottom: 3px solid #121212; }
.wired-variant .login-brand h1 { font-family: 'Preview Serif', 'Songti SC', serif; font-size: clamp(30px, 3.7vw, 46px); font-weight: 700; }
.wired-variant .login-brand p { font-size: 12px; }
.wired-variant .login-form { border: 0; border-bottom: 1px solid #121212; padding: 28px 0; border-radius: 0; }
.wired-variant .login-form h2 { font-family: 'Preview Serif', 'Songti SC', serif; font-weight: 600; font-size: 27px; }
.wired-variant :is(button,a,input,select):focus-visible { outline: 2px solid #125c85; outline-offset: 4px; }
@media (max-width: 1100px) {
  .wired-variant .wired-header { padding-inline: 28px; }
  .wired-variant .wired-main { padding-inline: 28px; }
  .wired-variant .overview-grid { grid-template-columns: minmax(0,1.4fr) 300px; column-gap: 24px; }
  .wired-variant .stage-panel { padding-left: 22px; }
  .wired-variant .wired-scope { display: none; }
  .wired-variant .form-section { grid-template-columns: 170px minmax(0,1fr); gap: 26px; }
}
@media (max-width: 800px) {
  .wired-variant { --v-title-size: 38px; }
  .wired-variant .wired-header { padding-inline: 22px; }
  .wired-variant .wired-masthead { min-height: 94px; gap: 16px; }
  .wired-variant .wired-brand { font-size: 28px; }
  .wired-variant .wired-navigation button { flex: 1; padding-inline: 10px; }
  .wired-variant .wired-main { padding: 28px 22px 44px; }
  .wired-variant .overview-grid { grid-template-columns: minmax(0,1fr); grid-template-areas: 'metrics' 'ledger' 'stage' 'summary'; }
  .wired-variant .stage-panel { padding: 26px 0 0; border-left: 0; border-top: 1px solid #121212; }
  .wired-variant .project-summary dl { grid-template-columns: repeat(2,minmax(0,1fr)); }
  .wired-variant .metric-cell { padding-inline: 18px; }
  .wired-variant .metric-cell strong { font-size: 31px; }
  .wired-variant .form-section { display: block; }
  .wired-variant .form-section h2 { margin-bottom: 24px; }
}
@media (max-width: 640px) {
  .wired-variant .wired-masthead { grid-template-columns: 1fr auto; gap: 4px 12px; padding-block: 15px; }
  .wired-variant .wired-brand { order: 0; justify-self: start; font-size: 26px; }
  .wired-variant .wired-account { order: 1; font-size: 12px; }
  .wired-variant .wired-directory { display: none; }
  .wired-variant .wired-navigation button { font-size: 12px; padding-inline: 6px; min-height: 44px; }
  .wired-variant .content-heading { align-items: flex-start; gap: 20px; padding-bottom: 24px; }
  .wired-variant .metrics-strip { grid-template-columns: minmax(0,1fr); }
  .wired-variant .metric-cell, .wired-variant .metric-cell:first-child, .wired-variant .metric-cell:last-child { padding: 20px 0; }
  .wired-variant .metric-cell + .metric-cell { border-left: 0; border-top: 1px solid var(--v-line); }
  .wired-variant .metric-cell strong { font-size: 31px; }
  .wired-variant .metric-cell > div { margin: 0; }
  .wired-variant .metric-cell p { max-width: 16ch; }
  .wired-variant .panel-heading h2 { font-size: 21px; }
  .wired-variant .directory-detail { width: 100%; }
  .wired-variant .directory-detail h2 { font-size: 25px; }
  .wired-variant .directory-detail dl { gap: 25px; }
  .wired-variant .material-editor { padding: 20px; }
  .wired-variant .primary-action, .wired-variant .secondary-action { padding-inline: 16px; }
}
@media (max-width: 360px) {
  .wired-variant .wired-header, .wired-variant .wired-main { padding-inline: 16px; }
  .wired-variant .wired-brand { font-size: 23px; }
  .wired-variant .wired-account svg { display: none; }
  .wired-variant .metric-cell strong { font-size: 28px; }
}
</style>
