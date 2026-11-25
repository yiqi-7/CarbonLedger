<script setup lang="ts">
import { Document, FolderOpened, Grid, Link, OfficeBuilding, Setting } from '@element-plus/icons-vue'
import type { PageId } from '../types'
import { usePreview } from '../state'
import PreviewContent from '../PreviewContent.vue'

defineProps<{ page: PageId }>()
const emit = defineEmits<{ navigate: [page: PageId] }>()
const state = usePreview()
const projectPages = [
  { id: 'overview' as const, label: '项目概览', icon: Document },
  { id: 'materials' as const, label: '建材清单', icon: Grid },
  { id: 'project' as const, label: '项目信息', icon: Setting },
]
</script>

<template>
  <div class="variant-notion" :class="{ 'notion-login': page === 'login' }">
    <aside v-if="page !== 'login'" class="notion-directory">
      <div class="notion-brand">
        <span class="notion-brand-icon"><OfficeBuilding aria-hidden="true" /></span>
        <span>碳建智算平台</span>
      </div>

      <nav class="notion-navigation" aria-label="工作台导航">
        <button
          type="button"
          class="notion-nav-link notion-directory-link"
          :class="{ active: page === 'projects' }"
          :aria-current="page === 'projects' ? 'page' : undefined"
          @click="emit('navigate', 'projects')"
        >
          <FolderOpened aria-hidden="true" />
          <span>项目目录</span>
        </button>
        <div class="notion-directory-label">当前项目</div>
        <div class="notion-project-name" :title="state.project.name">
          <OfficeBuilding aria-hidden="true" />
          <span>{{ state.project.name }}</span>
        </div>
        <div class="notion-project-pages">
          <button
            v-for="item in projectPages"
            :key="item.id"
            type="button"
            class="notion-nav-link"
            :class="{ active: page === item.id }"
            :aria-current="page === item.id ? 'page' : undefined"
            @click="emit('navigate', item.id)"
          >
            <component :is="item.icon" aria-hidden="true" />
            <span>{{ item.label }}</span>
          </button>
        </div>
      </nav>

      <div class="notion-directory-footer">
        <a class="notion-reference" href="https://www.zjzj.net" target="_blank" rel="noopener noreferrer">
          <Link aria-hidden="true" />
          <span>指导价格</span>
          <span class="notion-external" aria-hidden="true">↗</span>
        </a>
        <button type="button" class="notion-account" @click="emit('navigate', 'login')">
          <span class="notion-avatar" aria-hidden="true">演</span>
          <span class="notion-account-copy"><strong>演示账户</strong><span>查看登录页</span></span>
        </button>
      </div>
    </aside>

    <div class="notion-workspace">
      <header v-if="page !== 'login'" class="notion-document-path">
        <div class="notion-breadcrumb">
          <button type="button" @click="emit('navigate', 'projects')">我的项目</button>
          <span v-if="page !== 'projects'" class="notion-path-separator" aria-hidden="true">/</span>
          <span v-if="page !== 'projects'" class="notion-path-current">{{ state.project.name }}</span>
        </div>
        <span class="notion-stage-label">建造阶段</span>
      </header>
      <main class="variant-body notion-document">
        <PreviewContent :page="page" @navigate="emit('navigate', $event)" />
      </main>
    </div>
  </div>
</template>

<style>
.variant-notion {
  --v-bg: #ffffff;
  --v-surface: #ffffff;
  --v-text: #37352f;
  --v-muted: #706d65;
  --v-line: #e5e3df;
  --v-accent: #5645d4;
  --v-tint: #efedf8;
  --v-radius: 5px;
  --v-font: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  --v-title-weight: 700;
  --v-title-size: 34px;
  display: grid;
  grid-template-columns: 216px minmax(0, 1fr);
  min-height: calc(100svh - 96px);
  color: var(--v-text);
  background: var(--v-bg);
  font-family: var(--v-font);
  font-size: 14px;
}

.variant-notion button,
.variant-notion input,
.variant-notion select {
  font-family: inherit;
}

.variant-notion .notion-directory {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 23px 12px 16px;
  border-right: 1px solid #eae8e4;
  background: #f6f5f4;
}

.variant-notion .notion-brand {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 0 6px;
  color: #282722;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -.3px;
}

.variant-notion .notion-brand-icon {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 1px solid #b8b4ac;
  border-radius: 5px;
  background: white;
}

.variant-notion .notion-brand-icon svg { width: 20px; height: 20px; }
.variant-notion .notion-navigation { margin-top: 32px; }

.variant-notion .notion-nav-link {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  min-height: 40px;
  padding: 9px 10px;
  border: 0;
  border-radius: 5px;
  color: #625f58;
  background: transparent;
  font-size: 14px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
}

.variant-notion .notion-nav-link svg,
.variant-notion .notion-project-name svg,
.variant-notion .notion-reference svg { width: 17px; height: 17px; flex: 0 0 auto; }
.variant-notion .notion-nav-link:hover { background: #eae8e4; color: #37352f; }
.variant-notion .notion-nav-link.active { color: #37352f; background: #e7e5e1; font-weight: 650; }
.variant-notion .notion-directory-label { margin: 29px 10px 10px; color: #7b776f; font-size: 12px; }
.variant-notion .notion-project-name { display: flex; align-items: center; gap: 8px; padding: 8px 10px; font-size: 13px; font-weight: 600; }
.variant-notion .notion-project-name span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.variant-notion .notion-project-pages { margin-top: 2px; padding-left: 11px; }
.variant-notion .notion-directory-footer { display: grid; gap: 16px; margin-top: auto; padding-top: 48px; }
.variant-notion .notion-reference { display: flex; align-items: center; gap: 9px; min-height: 40px; padding: 8px 10px; color: #5f5c55; text-decoration: none; }
.variant-notion .notion-reference:hover { color: #0075de; text-decoration: underline; text-underline-offset: 3px; }
.variant-notion .notion-external { margin-left: auto; color: #7b776f; font-size: 16px; }
.variant-notion .notion-account { display: flex; align-items: center; gap: 9px; width: 100%; padding: 14px 8px 0; border: 0; border-top: 1px solid #dfdcd6; background: transparent; color: inherit; text-align: left; cursor: pointer; }
.variant-notion .notion-avatar { display: grid; place-items: center; flex: 0 0 30px; height: 30px; border-radius: 5px; color: #5e594e; background: #e6e1d8; font-size: 13px; }
.variant-notion .notion-account-copy { display: grid; gap: 3px; }
.variant-notion .notion-account-copy strong { font-size: 12px; font-weight: 600; }
.variant-notion .notion-account-copy > span { font-size: 11px; color: #706d65; }

.variant-notion .notion-workspace { min-width: 0; }
.variant-notion .notion-document-path { display: flex; align-items: center; justify-content: space-between; gap: 20px; min-height: 60px; padding: 12px 32px; font-size: 12px; }
.variant-notion .notion-breadcrumb { display: flex; align-items: center; gap: 12px; min-width: 0; }
.variant-notion .notion-breadcrumb button { flex-shrink: 0; padding: 8px 0; border: 0; color: #706d65; background: transparent; cursor: pointer; font-size: inherit; }
.variant-notion .notion-breadcrumb button:hover { color: #37352f; text-decoration: underline; text-underline-offset: 3px; }
.variant-notion .notion-path-separator { color: #aaa59b; }
.variant-notion .notion-path-current { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.variant-notion .notion-stage-label { flex-shrink: 0; padding: 4px 7px; border-radius: 3px; background: #ece9e4; color: #706451; font-size: 11px; }
.variant-notion .notion-document { max-width: 1120px; margin: 0 auto; padding: 32px 56px 64px; }
.variant-notion .content-heading { align-items: flex-end; margin-bottom: 32px; }
.variant-notion .content-heading h1 { color: #2d2c28; line-height: 1.25; letter-spacing: -.8px; }
.variant-notion .content-heading p { margin-top: 10px; color: #78746c; line-height: 1.65; }
.variant-notion .heading-actions { gap: 8px; }
.variant-notion .overview-grid { grid-template-columns: minmax(0, 1.55fr) minmax(220px, 1fr); gap: 32px; }
.variant-notion .metrics-strip { grid-column: 1 / -1; border: 0; border-top: 1px solid var(--v-line); border-bottom: 1px solid var(--v-line); border-radius: 0; background: transparent; box-shadow: none; }
.variant-notion .metric-cell { padding: 21px 16px; background: transparent; }
.variant-notion .metric-cell:first-child { padding-left: 0; }
.variant-notion .metric-cell:last-child { padding-right: 0; }
.variant-notion .metric-cell + .metric-cell { border-left: 1px solid var(--v-line); }
.variant-notion .stage-panel,
.variant-notion .ledger-panel,
.variant-notion .project-summary { padding: 0; border: 0; border-radius: 0; background: transparent; box-shadow: none; }
.variant-notion .stage-panel { grid-column: auto; }
.variant-notion .ledger-panel { grid-column: 1 / -1; }
.variant-notion .project-summary { padding-left: 28px; border-left: 1px solid var(--v-line); }
.variant-notion .panel-heading { margin-bottom: 18px; padding: 0; }
.variant-notion .panel-heading h2 { color: #37352f; font-size: 16px; font-weight: 650; }
.variant-notion .stage-bars { padding: 4px 0 22px; }
.variant-notion .recovery-line,
.variant-notion .net-line { margin-left: 0; margin-right: 0; }
.variant-notion .project-summary dl { padding: 0 0 20px; }
.variant-notion .project-summary .calculation-note { margin: 0; }
.variant-notion .table-scroll { border-radius: 0; border: 0; border-top: 1px solid var(--v-line); }
.variant-notion .preview-table { font-size: 14px; }
.variant-notion .preview-table th { color: #78746c; background: #fafaf9; font-size: 12px; font-weight: 500; }
.variant-notion .preview-table td { padding-top: 15px; padding-bottom: 15px; }
.variant-notion .preview-table tbody tr:hover { background: #fafaf9; }
.variant-notion .preview-table th:first-child,
.variant-notion .preview-table td:first-child { padding-left: 12px; }
.variant-notion .preview-table th:last-child,
.variant-notion .preview-table td:last-child { padding-right: 12px; }
.variant-notion .material-ledger { border: 0; border-radius: 0; background: transparent; }
.variant-notion .table-toolbar { padding: 0 0 16px; border: 0; background: transparent; }
.variant-notion .table-summary { padding: 16px 0; }
.variant-notion .material-type { display: inline-block; margin-top: 6px; padding: 1px 6px; border-radius: 3px; color: #625a75; background: #efedf5; }
.variant-notion .material-editor { padding: 20px 0 24px; border: 0; border-top: 1px solid var(--v-line); border-bottom: 1px solid var(--v-line); border-radius: 0; background: transparent; }
.variant-notion .material-editor .field-grid { padding-top: 8px; }
.variant-notion .project-form { max-width: 780px; padding: 0; border: 0; border-radius: 0; background: transparent; }
.variant-notion .form-section h2 { padding-bottom: 16px; border-bottom: 1px solid var(--v-line); font-size: 16px; }
.variant-notion .preview-field > span { color: #706d65; font-size: 13px; font-weight: 400; }
.variant-notion .preview-field input,
.variant-notion .preview-field select { background: #fafaf9; }
.variant-notion .directory-project { padding: 26px 12px; gap: 18px; border: 0; border-top: 1px solid var(--v-line); border-bottom: 1px solid var(--v-line); border-radius: 0; background: transparent; }
.variant-notion .directory-project:hover { background: #fafaf9; border-color: var(--v-line); }
.variant-notion .directory-icon { color: #706451; }
.variant-notion .directory-icon svg { width: 25px; height: 25px; }
.variant-notion .directory-detail h2 { font-size: 19px; }
.variant-notion .directory-detail dl { gap: 32px; margin-top: 20px; }
.variant-notion .directory-open { color: #0075de; }
.variant-notion .primary-action { border: 1px solid #5645d4; border-radius: 5px; background: #5645d4; box-shadow: none; }
.variant-notion .primary-action:hover { border-color: #4534b3; background: #4534b3; }
.variant-notion .secondary-action { border-color: #d7d3cb; border-radius: 5px; background: #ffffff; box-shadow: none; }
.variant-notion .secondary-action:hover { border-color: #bdb8ae; background: #f6f5f4; }
.variant-notion .text-action { color: #0075de; }
.variant-notion :is(button, a, input, select):focus-visible { outline: 2px solid #5645d4; outline-offset: 3px; }
.variant-notion.notion-login { display: block; background: #fafaf9; }
.variant-notion.notion-login .notion-document { max-width: none; padding: 0; }
.variant-notion .page-login { padding: 44px 24px; }
.variant-notion .login-composition { width: min(100%, 420px); }
.variant-notion .login-brand h1 { font-size: 34px; }
.variant-notion .login-form { padding: 28px; box-shadow: none; }

@media (max-width: 1100px) {
  .variant-notion { grid-template-columns: 196px minmax(0, 1fr); }
  .variant-notion .notion-document { padding: 24px 32px 48px; }
  .variant-notion .overview-grid { grid-template-columns: minmax(0, 1fr); gap: 28px; }
  .variant-notion .project-summary { padding: 24px 0 0; border-left: 0; border-top: 1px solid var(--v-line); }
}

@media (max-width: 760px) {
  .variant-notion { --v-title-size: 30px; display: block; }
  .variant-notion .notion-directory { padding: 16px 16px 0; border-right: 0; border-bottom: 1px solid var(--v-line); }
  .variant-notion .notion-brand { padding: 0; }
  .variant-notion .notion-brand-icon { width: 27px; height: 27px; }
  .variant-notion .notion-navigation { display: flex; gap: 4px; margin-top: 16px; padding-bottom: 8px; overflow-x: auto; }
  .variant-notion .notion-nav-link { width: auto; min-width: max-content; min-height: 42px; gap: 6px; padding: 8px; font-size: 13px; }
  .variant-notion .notion-project-pages { display: flex; gap: 4px; margin: 0; padding: 0; }
  .variant-notion .notion-directory-label,
  .variant-notion .notion-project-name,
  .variant-notion .notion-directory-footer { display: none; }
  .variant-notion .notion-document-path { min-height: 48px; gap: 12px; padding: 10px 20px; }
  .variant-notion .notion-breadcrumb { gap: 8px; }
  .variant-notion .notion-document { padding: 20px 20px 40px; }
  .variant-notion .content-heading { align-items: flex-start; gap: 18px; margin-bottom: 24px; }
  .variant-notion .heading-actions { justify-content: flex-start; }
  .variant-notion .content-heading h1 { letter-spacing: -.4px; }
  .variant-notion .metric-cell { padding: 17px 10px; }
  .variant-notion .panel-heading { margin-bottom: 15px; }
}

@media (max-width: 640px) {
  .variant-notion .metric-cell { padding: 17px 0; }
  .variant-notion .metric-cell + .metric-cell { border-left: 0; }
  .variant-notion .directory-project { padding: 22px 0; gap: 12px; }
  .variant-notion .directory-detail dl { gap: 18px; }
  .variant-notion .directory-open { justify-content: flex-start; padding-left: 37px; }
  .variant-notion .page-login { min-height: calc(100svh - 136px); padding: 36px 20px; }
  .variant-notion .login-brand h1 { font-size: 30px; }
  .variant-notion .login-form { padding: 26px 22px; }
}

@media (max-width: 400px) {
  .variant-notion { --v-title-size: 28px; }
  .variant-notion .notion-directory { padding-left: 12px; padding-right: 12px; }
  .variant-notion .notion-nav-link { padding-left: 7px; padding-right: 7px; }
  .variant-notion .notion-nav-link svg { display: none; }
  .variant-notion .notion-document-path { padding-left: 16px; padding-right: 16px; }
  .variant-notion .notion-document { padding-left: 16px; padding-right: 16px; }
  .variant-notion .notion-stage-label { display: none; }
}
</style>
