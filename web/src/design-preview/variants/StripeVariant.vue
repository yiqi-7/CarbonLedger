<script setup lang="ts">
import { ArrowLeft, Document, Grid, User } from '@element-plus/icons-vue'
import PreviewContent from '../PreviewContent.vue'
import { usePreview } from '../state'
import type { PageId } from '../types'

defineProps<{ page: PageId }>()
const emit = defineEmits<{ navigate: [page: PageId] }>()
const state = usePreview()
const navItems = [
  { page: 'overview' as const, label: '项目概览', icon: Grid },
  { page: 'materials' as const, label: '建材清单', icon: Document },
  { page: 'project' as const, label: '项目信息', icon: User },
]
</script>

<template>
  <div class="stripe-variant" :class="{ 'stripe-login': page === 'login' }">
    <template v-if="page !== 'login'">
      <header class="stripe-header">
        <button class="stripe-brand" type="button" @click="emit('navigate', 'projects')">碳建智算平台</button>
        <nav class="stripe-navigation" aria-label="业务导航">
          <button
            v-for="item in navItems"
            :key="item.page"
            type="button"
            :class="{ active: page === item.page }"
            :aria-current="page === item.page ? 'page' : undefined"
            @click="emit('navigate', item.page)"
          >
            <component :is="item.icon" aria-hidden="true" />
            <span>{{ item.label }}</span>
          </button>
        </nav>
        <button class="stripe-account" type="button" @click="emit('navigate', 'login')">登录页</button>
      </header>
      <div class="stripe-project-path">
        <button type="button" @click="emit('navigate', 'projects')"><ArrowLeft aria-hidden="true" />项目目录</button>
        <template v-if="page !== 'projects'">
          <span class="stripe-path-divider" aria-hidden="true">/</span>
          <span class="stripe-current-project">{{ state.project.name }}</span>
        </template>
      </div>
    </template>
    <main class="variant-body">
      <PreviewContent :page="page" @navigate="emit('navigate', $event)" />
    </main>
  </div>
</template>

<style>
.stripe-variant {
  --v-bg: #f6f9fc;
  --v-surface: #fff;
  --v-text: #0d253d;
  --v-muted: #576a82;
  --v-line: #e3e8ee;
  --v-accent: #533afd;
  --v-tint: #efedff;
  --v-radius: 12px;
  --v-font: 'Segoe UI', 'Microsoft YaHei UI', 'Microsoft YaHei', 'PingFang SC', sans-serif;
  --v-title-weight: 400;
  --v-title-size: 30px;
  min-height: calc(100svh - 96px);
  background: var(--v-bg);
  color: var(--v-text);
  font-family: var(--v-font);
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  color-scheme: light;
}
.stripe-variant ::selection { color: #0d253d; background: #d9d4ff; }
.stripe-variant :is(input, textarea) { caret-color: var(--v-accent); }
.stripe-variant :is(button, a, input, select, textarea):focus-visible {
  outline: 2px solid var(--v-accent);
  outline-offset: 3px;
}
.stripe-variant button { font-family: inherit; }
.stripe-header {
  min-height: 76px;
  display: flex;
  align-items: center;
  gap: 40px;
  padding: 12px 40px;
  background: #fff;
  border-bottom: 1px solid var(--v-line);
}
.stripe-brand {
  border: 0;
  background: none;
  padding: 8px 0;
  color: var(--v-text);
  font-size: 20px;
  font-weight: 650;
  letter-spacing: -.02em;
  white-space: nowrap;
  cursor: pointer;
}
.stripe-navigation { display: flex; align-items: center; gap: 6px; }
.stripe-navigation button {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 8px 15px;
  border: 0;
  border-radius: 999px;
  color: var(--v-muted);
  background: transparent;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}
.stripe-navigation button:hover { color: var(--v-text); background: #f6f9fc; }
.stripe-navigation button.active { color: #4434d4; background: var(--v-tint); }
.stripe-navigation svg, .stripe-project-path svg { width: 17px; height: 17px; flex: 0 0 17px; }
.stripe-account {
  min-height: 40px;
  margin-left: auto;
  padding: 8px 15px;
  border: 1px solid var(--v-line);
  border-radius: 999px;
  color: var(--v-text);
  background: #fff;
  font-size: 13px;
  white-space: nowrap;
  cursor: pointer;
}
.stripe-account:hover { border-color: #a8c3de; background: #f6f9fc; }
.stripe-project-path {
  display: flex;
  align-items: center;
  gap: 14px;
  max-width: 1560px;
  margin: 0 auto;
  padding: 22px 40px 0;
  font-size: 13px;
}
.stripe-project-path button {
  display: flex;
  align-items: center;
  gap: 7px;
  min-height: 32px;
  flex-shrink: 0;
  padding: 4px 0;
  border: 0;
  background: none;
  color: var(--v-muted);
  cursor: pointer;
}
.stripe-project-path button:hover { color: var(--v-accent); }
.stripe-path-divider { color: #667a93; }
.stripe-current-project { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.stripe-variant .variant-body { max-width: 1560px; margin: 0 auto; padding: 25px 40px 48px; }
.stripe-variant .content-heading { align-items: center; gap: 24px; margin-bottom: 30px; }
.stripe-variant .content-heading h1 { letter-spacing: -.025em; line-height: 1.3; font-weight: 400; }
.stripe-variant .content-heading p { color: var(--v-muted); margin-top: 8px; }
.stripe-variant .primary-action,
.stripe-variant .secondary-action { border-radius: 999px; padding-inline: 18px; font-weight: 500; }
.stripe-variant .primary-action { box-shadow: none; }
.stripe-variant .primary-action:hover { background: #4434d4; }
.stripe-variant .primary-action:active { background: #2e2b8c; }
.stripe-variant .secondary-action { background: #fff; border-color: #cbd5df; color: var(--v-text); }
.stripe-variant .overview-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 270px;
  grid-template-areas: 'metrics summary' 'stages summary' 'ledger summary';
  align-items: start;
  gap: 24px;
}
.stripe-variant .metrics-strip { grid-area: metrics; border-radius: 12px; }
.stripe-variant .metric-cell { padding: 22px 20px; }
.stripe-variant .metric-cell > div { display: block; margin: 9px 0 8px; }
.stripe-variant .metric-cell strong { display: block; font-size: clamp(24px, 2.5vw, 32px); font-weight: 400; letter-spacing: -.025em; }
.stripe-variant .metric-cell small { display: block; margin-top: 3px; }
.stripe-variant .stage-panel { grid-area: stages; }
.stripe-variant .ledger-panel { grid-area: ledger; }
.stripe-variant .project-summary { grid-area: summary; align-self: start; min-height: 0; background: #fff; }
.stripe-variant .project-summary dl { gap: 20px; }
.stripe-variant .project-summary dl > div { display: grid; gap: 5px; }
.stripe-variant .project-summary dd { text-align: left; font-size: 14px; }
.stripe-variant .panel-heading { padding-bottom: 20px; }
.stripe-variant .panel-heading h2 { font-size: 17px; font-weight: 600; letter-spacing: -.01em; }
.stripe-variant :is(.stage-panel, .ledger-panel, .project-summary) { border-radius: 12px; padding: 0; box-shadow: none; }
.stripe-variant .stage-bars { display: grid; gap: 21px; }
.stripe-variant .stage-row { font-variant-numeric: tabular-nums; }
.stripe-variant .preview-table { font-size: 14px; font-variant-numeric: tabular-nums; }
.stripe-variant .preview-table th { background: #f6f9fc; color: #576a82; font-size: 13px; font-weight: 500; }
.stripe-variant .preview-table :is(th, td) { padding: 15px 16px; }
.stripe-variant .preview-table tbody tr:hover { background: #f8faff; }
.stripe-variant .table-toolbar { padding-block: 18px; gap: 12px; }
.stripe-variant .table-toolbar :is(input, select) { border-color: #b5c4d4; border-radius: 6px; }
.stripe-variant .preview-field :is(input, select, textarea) { border-color: #b5c4d4; border-radius: 6px; }
.stripe-variant .field-grid { gap: 26px 32px; }
.stripe-variant .project-form { max-width: 1080px; padding: 30px 32px; }
.stripe-variant .project-form .form-section { display: grid; grid-template-columns: 160px minmax(0, 1fr); gap: 24px; }
.stripe-variant .project-form .form-section + .form-section { padding-top: 30px; border-top: 1px solid var(--v-line); }
.stripe-variant .form-section h2 { font-size: 16px; font-weight: 600; margin: 0; }
.stripe-variant .preview-field > span { font-size: 13px; }
.stripe-variant .material-editor { padding-bottom: 24px; }
.stripe-variant .text-action { font-weight: 500; text-underline-offset: 3px; }
.stripe-variant .text-action:hover { text-decoration: underline; }
.stripe-variant .table-scroll { scrollbar-color: #b5c4d4 #f6f9fc; scrollbar-width: thin; }
.stripe-variant.stripe-login { background: #f6f9fc; }
.stripe-variant.stripe-login .variant-body { max-width: none; min-height: 0; padding: 0; }
.stripe-variant .login-brand h1 { font-weight: 400; }
.stripe-variant .login-form h2 { font-weight: 500; }

@media (min-width: 1440px) {
  .stripe-variant .overview-grid { grid-template-columns: minmax(0, 1fr) 310px; gap: 30px; }
  .stripe-variant .variant-body { padding-top: 30px; }
}
@media (max-width: 1050px) {
  .stripe-header { gap: 20px; padding-inline: 26px; }
  .stripe-project-path { padding-inline: 26px; }
  .stripe-variant .variant-body { padding-inline: 26px; }
  .stripe-variant .overview-grid { grid-template-columns: minmax(0, 1fr) 230px; gap: 18px; }
  .stripe-variant .metric-cell { padding: 20px 16px; }
}
@media (max-width: 850px) {
  .stripe-header { flex-wrap: wrap; gap: 10px 18px; padding: 14px 24px 12px; }
  .stripe-brand { order: 0; }
  .stripe-account { order: 1; }
  .stripe-navigation { order: 2; width: 100%; gap: 6px; }
  .stripe-navigation button { flex: 1; justify-content: center; }
  .stripe-variant .overview-grid {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: 'metrics' 'stages' 'ledger' 'summary';
  }
  .stripe-variant .content-heading { align-items: flex-start; }
  .stripe-variant .project-summary dl { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .stripe-variant .project-form .form-section { grid-template-columns: minmax(0, 1fr); gap: 22px; }
}
@media (max-width: 520px) {
  .stripe-variant { --v-title-size: 26px; }
  .stripe-header { padding: 12px 16px; gap: 12px 8px; }
  .stripe-brand { font-size: 18px; }
  .stripe-account { padding: 8px 13px; min-height: 44px; }
  .stripe-navigation { gap: 2px; }
  .stripe-navigation button { padding: 10px 8px; gap: 5px; min-height: 44px; font-size: 13px; }
  .stripe-navigation svg { display: none; }
  .stripe-project-path { padding: 14px 16px 0; gap: 10px; }
  .stripe-project-path button { min-height: 44px; }
  .stripe-variant .variant-body { padding: 18px 16px 32px; }
  .stripe-variant .content-heading { align-items: flex-start; gap: 18px; margin-bottom: 24px; }
  .stripe-variant .metric-cell { padding: 18px 16px; }
  .stripe-variant .metric-cell > div { margin: 0; text-align: right; }
  .stripe-variant .metric-cell strong { font-size: 26px; }
  .stripe-variant .project-summary dl { gap: 18px; }
  .stripe-variant .project-form { padding: 24px 20px; }
  .stripe-variant .preview-table :is(th, td) { padding: 14px 12px; }
  .stripe-variant .field-grid { gap: 22px; }
}
</style>
