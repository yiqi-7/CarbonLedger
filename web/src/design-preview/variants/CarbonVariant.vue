<script setup lang="ts">
import { computed } from 'vue'
import { DataAnalysis, Document, FolderOpened, Setting, User, ArrowLeft } from '@element-plus/icons-vue'
import type { PageId } from '../types'
import { usePreview } from '../state'
import PreviewContent from '../PreviewContent.vue'

const props = defineProps<{ page: PageId }>()
const emit = defineEmits<{ navigate: [page: PageId] }>()
const state = usePreview()
const navigation = [
  { id: 'overview' as const, label: '项目概览', icon: DataAnalysis },
  { id: 'materials' as const, label: '建材清单', icon: Document },
  { id: 'project' as const, label: '项目信息', icon: Setting },
  { id: 'projects' as const, label: '项目目录', icon: FolderOpened },
]
const pageTitle = computed(() => ({
  overview: '项目概览',
  materials: '建材清单',
  project: '项目信息',
  projects: '项目目录',
  login: '登录',
}[props.page]))
</script>

<template>
  <div class="carbon-variant" :class="{ 'is-login': page === 'login' }">
    <header v-if="page !== 'login'" class="carbon-topbar">
      <button class="carbon-brand" type="button" @click="emit('navigate', 'overview')">
        <span class="carbon-brand-mark">碳</span>
        <span>碳建智算平台</span>
      </button>
      <div class="carbon-breadcrumb"><span>项目工作区</span><b>/</b><strong>{{ pageTitle }}</strong></div>
      <button class="carbon-account" type="button" @click="emit('navigate', 'login')">
        <User aria-hidden="true" /><span>示例账号</span>
      </button>
    </header>
    <div v-if="page !== 'login'" class="carbon-layout">
      <aside class="carbon-sidebar">
        <div class="carbon-project-switcher"><span>当前项目</span><strong>{{ state.project.name }}</strong><small>{{ state.project.location }}</small></div>
        <nav aria-label="项目功能" class="carbon-navigation">
          <button v-for="item in navigation" :key="item.id" type="button" :class="{ active: page === item.id }" :aria-current="page === item.id ? 'page' : undefined" @click="emit('navigate', item.id)">
            <component :is="item.icon" aria-hidden="true" /><span>{{ item.label }}</span>
          </button>
        </nav>
        <div class="carbon-sidebar-summary"><span>建造阶段</span><strong>{{ Number(state.netEmission).toLocaleString('zh-CN', { maximumFractionDigits: 1 }) }}</strong><small>tCO₂e 净排放</small></div>
        <button class="carbon-sidebar-back" type="button" @click="emit('navigate', 'projects')"><ArrowLeft aria-hidden="true" />返回项目目录</button>
      </aside>
      <main class="carbon-main"><PreviewContent :page="page" @navigate="emit('navigate', $event)" /></main>
    </div>
    <main v-else class="carbon-login"><PreviewContent :page="page" @navigate="emit('navigate', $event)" /></main>
  </div>
</template>

<style>
.carbon-variant {
  --v-bg: #F5F5F7;
  --v-surface: #FFFFFF;
  --v-text: #1D1D1F;
  --v-muted: #6E6E73;
  --v-line: rgba(0, 0, 0, 0.10);
  --v-accent: #0071E3;
  --v-tint: #E8F2FC;
  --v-radius: 24px;
  --v-font: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  min-height: calc(100svh - var(--lab-toolbar-height, 96px));
  background: var(--v-bg);
  color: var(--v-text);
  font-family: var(--v-font);
}
.carbon-variant button, .carbon-variant input, .carbon-variant select { font: inherit; }
.carbon-variant button:focus-visible, .carbon-variant a:focus-visible { outline: 2px solid var(--v-accent); outline-offset: 3px; }
.carbon-topbar { min-height: 64px; display: flex; align-items: center; gap: 28px; padding: 0 32px; border-bottom: 1px solid var(--v-line); background: rgba(255,255,255,.94); }
.carbon-brand { display: inline-flex; align-items: center; gap: 10px; min-height: 40px; padding: 0; border: 0; background: transparent; color: var(--v-text); font-size: 15px; font-weight: 600; white-space: nowrap; }
.carbon-brand-mark { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 50%; background: #000; color: #fff; font-size: 12px; font-weight: 700; }
.carbon-breadcrumb { display: flex; align-items: center; gap: 10px; color: var(--v-muted); font-size: 13px; }
.carbon-breadcrumb b { color: #C7C7CC; font-weight: 400; }
.carbon-breadcrumb strong { color: var(--v-text); font-weight: 500; }
.carbon-account { display: inline-flex; align-items: center; gap: 7px; min-height: 36px; margin-left: auto; padding: 0 12px; border: 0; border-radius: 999px; background: transparent; color: var(--v-muted); font-size: 13px; }
.carbon-account:hover { background: var(--v-bg); color: var(--v-text); }
.carbon-account svg { width: 16px; }
.carbon-layout { display: grid; grid-template-columns: 232px minmax(0, 1fr); min-height: calc(100svh - var(--lab-toolbar-height, 96px) - 64px); }
.carbon-sidebar { display: flex; flex-direction: column; gap: 28px; padding: 26px 14px 20px; border-right: 1px solid var(--v-line); background: #fff; }
.carbon-project-switcher { display: grid; gap: 5px; padding: 0 10px; }
.carbon-project-switcher span, .carbon-sidebar-summary span { color: var(--v-muted); font-size: 11px; }
.carbon-project-switcher strong { overflow: hidden; color: var(--v-text); font-size: 14px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.carbon-project-switcher small, .carbon-sidebar-summary small { color: var(--v-muted); font-size: 11px; }
.carbon-navigation { display: grid; gap: 5px; }
.carbon-navigation button { display: flex; align-items: center; gap: 11px; width: 100%; min-height: 42px; padding: 0 12px; border: 0; border-radius: 12px; background: transparent; color: var(--v-muted); text-align: left; font-size: 13px; }
.carbon-navigation button:hover { background: var(--v-bg); color: var(--v-text); }
.carbon-navigation button.active { background: var(--v-tint); color: var(--v-accent); font-weight: 600; }
.carbon-navigation svg { width: 17px; }
.carbon-sidebar-summary { display: grid; gap: 4px; margin-top: auto; padding: 16px; border-radius: 16px; background: var(--v-bg); }
.carbon-sidebar-summary strong { color: var(--v-text); font-size: 22px; font-weight: 600; font-variant-numeric: tabular-nums; }
.carbon-sidebar-back { display: inline-flex; align-items: center; gap: 7px; min-height: 36px; padding: 0 10px; border: 0; background: transparent; color: var(--v-muted); font-size: 12px; text-align: left; }
.carbon-sidebar-back:hover { color: var(--v-accent); }
.carbon-sidebar-back svg { width: 15px; }
.carbon-main { min-width: 0; padding: 56px clamp(24px, 5vw, 72px) 80px; }
.carbon-main .preview-content { max-width: 1180px; margin: 0 auto; }
.carbon-login { min-height: calc(100svh - var(--lab-toolbar-height, 96px)); display: grid; place-items: center; padding: 48px 24px; }
.carbon-login .preview-content { width: min(100%, 460px); }
.carbon-variant .preview-content h1 { font-weight: 600; }
.carbon-variant .preview-content .metrics-strip, .carbon-variant .preview-content .stage-panel, .carbon-variant .preview-content .project-summary, .carbon-variant .preview-content .ledger-panel, .carbon-variant .preview-content .material-ledger, .carbon-variant .preview-content .project-form, .carbon-variant .preview-content .login-form { box-shadow: 0 4px 16px rgba(0,0,0,.05); }
.carbon-variant .preview-content .primary-action { border-radius: 999px; box-shadow: 0 4px 14px rgba(0,113,227,.22); }
.carbon-variant .preview-content .secondary-action, .carbon-variant .preview-content input, .carbon-variant .preview-content select { border-radius: 12px; }
.carbon-variant .preview-content .stage-track { border-radius: 999px; }
@media (max-width: 780px) {
  .carbon-topbar { gap: 14px; padding-inline: 20px; }
  .carbon-breadcrumb { display: none; }
  .carbon-layout { grid-template-columns: 72px minmax(0, 1fr); }
  .carbon-sidebar { align-items: center; padding-inline: 10px; }
  .carbon-project-switcher strong, .carbon-project-switcher span, .carbon-project-switcher small, .carbon-navigation button span, .carbon-sidebar-summary, .carbon-sidebar-back { display: none; }
  .carbon-project-switcher { padding: 0; }
  .carbon-navigation { width: 100%; }
  .carbon-navigation button { justify-content: center; padding-inline: 0; }
  .carbon-main { padding: 36px 20px 56px; }
}
@media (max-width: 520px) {
  .carbon-topbar { min-height: 56px; padding-inline: 14px; }
  .carbon-brand { font-size: 14px; }
  .carbon-layout { display: block; }
  .carbon-sidebar { display: none; }
  .carbon-main { padding: 28px 14px 44px; }
}
</style>
