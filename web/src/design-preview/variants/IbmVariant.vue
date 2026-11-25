<script setup lang="ts">
import { DataAnalysis, Document, FolderOpened, Setting, User } from '@element-plus/icons-vue'
import type { PageId } from '../types'
import { usePreview } from '../state'
import PreviewContent from '../PreviewContent.vue'

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
  <div class="ibm-variant" :class="{ 'is-login': page === 'login' }">
    <header v-if="page !== 'login'" class="ibm-app-bar">
      <button class="ibm-brand" type="button" @click="emit('navigate', 'overview')">
        碳建智算<span>平台</span>
      </button>
      <span class="ibm-app-description">建造阶段碳排放核算</span>
      <button
        class="ibm-account"
        type="button"
        @click="emit('navigate', 'login')"
      >
        <User aria-hidden="true" />
        <span>登录</span>
      </button>
    </header>

    <div class="ibm-workspace">
      <aside v-if="page !== 'login'" class="ibm-sidebar">
        <div class="ibm-project-context">
          <span>当前项目</span>
          <strong>{{ state.project.name }}</strong>
        </div>
        <nav class="ibm-navigation" aria-label="项目功能">
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
        <div class="ibm-scope">
          <span>核算范围</span>
          <p>建造阶段</p>
          <small>材料 · 运输 · 施工 · 回收</small>
        </div>
      </aside>
      <main class="variant-body ibm-main">
        <PreviewContent :page="page" @navigate="emit('navigate', $event)" />
      </main>
    </div>
  </div>
</template>

<style>
.ibm-variant {
  --v-bg: #f4f4f4;
  --v-surface: #fff;
  --v-text: #161616;
  --v-muted: #525252;
  --v-line: #d9d9d9;
  --v-accent: #0f62fe;
  --v-tint: #edf5ff;
  --v-radius: 0px;
  --v-font: "IBM Plex Sans", "PingFang SC", "Microsoft YaHei", sans-serif;
  --v-title-weight: 400;
  --v-title-size: 30px;
  min-height: calc(100svh - 96px);
  display: flex;
  flex-direction: column;
  background: var(--v-bg);
  color: var(--v-text);
  font-family: var(--v-font);
  font-size: 14px;
}
.ibm-variant button,
.ibm-variant input,
.ibm-variant select {
  font: inherit;
}
.ibm-variant button:focus-visible,
.ibm-variant a:focus-visible {
  outline: 2px solid #0f62fe;
  outline-offset: 3px;
}
.ibm-app-bar {
  display: flex;
  align-items: center;
  min-height: 52px;
  padding: 0 24px;
  background: #161616;
  color: #fff;
}
.ibm-brand {
  align-self: stretch;
  flex-shrink: 0;
  border: 0;
  padding: 0;
  background: transparent;
  color: #fff;
  font-size: 17px !important;
  font-weight: 600 !important;
  cursor: pointer;
  letter-spacing: .035em;
}
.ibm-brand span {
  font-weight: 400;
}
.ibm-app-description {
  margin-left: 32px;
  padding-left: 24px;
  border-left: 1px solid #525252;
  color: #c6c6c6;
  font-size: 13px;
}
.ibm-account {
  display: inline-flex;
  align-self: stretch;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  padding: 0 0 0 24px;
  border: 0;
  background: transparent;
  color: #f4f4f4;
  cursor: pointer;
}
.ibm-account:hover,
.ibm-brand:hover {
  color: #a6c8ff;
}
.ibm-account svg {
  width: 18px;
  height: 18px;
}
.ibm-workspace {
  flex: 1;
  display: grid;
  grid-template-columns: 204px minmax(0, 1fr);
}
.ibm-sidebar {
  display: flex;
  flex-direction: column;
  padding: 25px 0 20px;
  border-right: 1px solid var(--v-line);
  background: #fff;
}
.ibm-project-context {
  padding: 0 20px 24px;
}
.ibm-project-context > span,
.ibm-scope > span {
  display: block;
  color: var(--v-muted);
  font-size: 12px;
  line-height: 1.6;
}
.ibm-project-context strong {
  display: block;
  margin-top: 7px;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.ibm-navigation {
  display: flex;
  flex-direction: column;
}
.ibm-navigation button {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 46px;
  border: 0;
  border-left: 3px solid transparent;
  padding: 10px 17px;
  background: transparent;
  color: #525252;
  text-align: left;
  cursor: pointer;
}
.ibm-navigation button:hover {
  background: #f4f4f4;
  color: #161616;
}
.ibm-navigation button.active {
  border-left-color: var(--v-accent);
  background: #e8e8e8;
  color: #161616;
  font-weight: 600;
}
.ibm-navigation svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}
.ibm-scope {
  margin-top: auto;
  padding: 40px 20px 0;
}
.ibm-scope p {
  margin: 6px 0;
  line-height: 1.5;
}
.ibm-scope small {
  color: #6f6f6f;
  font-size: 11px;
  line-height: 1.8;
}
.ibm-main {
  min-width: 0;
  padding: 30px 32px 40px;
}
.ibm-variant .content-heading {
  margin-bottom: 27px;
}
.ibm-variant .content-heading h1 {
  letter-spacing: -.025em;
  line-height: 1.25;
}
.ibm-variant .content-heading p {
  font-size: 13px;
  line-height: 1.6;
}
.ibm-variant .overview-grid {
  gap: 16px;
}
.ibm-variant .metrics-strip {
  border: 0;
  border-top: 1px solid #161616;
  border-bottom: 1px solid var(--v-line);
  border-radius: 0;
  background: #fff;
}
.ibm-variant .metric-cell {
  padding: 21px 22px 23px;
}
.ibm-variant .metric-cell + .metric-cell {
  border-left: 1px solid var(--v-line);
}
.ibm-variant .metric-cell strong {
  font-weight: 400;
  letter-spacing: -.04em;
}
.ibm-variant .stage-panel,
.ibm-variant .ledger-panel,
.ibm-variant .project-summary {
  border-radius: 0;
  border: 1px solid var(--v-line);
  box-shadow: none;
}
.ibm-variant .panel-heading {
  padding-bottom: 14px;
  border-bottom: 1px solid var(--v-line);
}
.ibm-variant .panel-heading h2 {
  font-size: 16px;
  font-weight: 600;
}
.ibm-variant .project-summary .panel-heading,
.ibm-variant .material-editor .panel-heading {
  margin-bottom: 18px;
}
.ibm-variant .stage-bars {
  margin-top: 18px;
}
.ibm-variant .stage-row {
  gap: 10px;
}
.ibm-variant .preview-table {
  font-size: 13px;
}
.ibm-variant .preview-table th {
  background: #e8e8e8;
  color: #161616;
  font-weight: 600;
}
.ibm-variant .preview-table th,
.ibm-variant .preview-table td {
  padding: 12px 16px;
  border-bottom: 1px solid #e0e0e0;
}
.ibm-variant .preview-table tbody tr:hover {
  background: #f4f4f4;
}
.ibm-variant .table-toolbar {
  gap: 12px;
}
.ibm-variant .primary-action,
.ibm-variant .secondary-action {
  min-height: 40px;
  border-radius: 0;
  padding: 10px 18px;
  font-weight: 400;
}
.ibm-variant .primary-action:hover {
  background: #0043ce;
}
.ibm-variant .secondary-action {
  border-color: #8d8d8d;
  background: transparent;
  color: #161616;
}
.ibm-variant .preview-field input,
.ibm-variant .preview-field select,
.ibm-variant .preview-field textarea,
.ibm-variant .table-toolbar input,
.ibm-variant .table-toolbar select {
  border-radius: 0;
  border: 0;
  border-bottom: 1px solid #8d8d8d;
  background: #f4f4f4;
}
.ibm-variant.is-login .ibm-workspace {
  grid-template-columns: minmax(0, 1fr);
}
.ibm-variant.is-login .ibm-main {
  display: grid;
  align-items: center;
  padding: 0;
}
@media (min-width: 1600px) {
  .ibm-main {
    padding: 36px 48px 48px;
  }
}
@media (max-width: 1000px) {
  .ibm-workspace {
    grid-template-columns: 180px minmax(0, 1fr);
  }
  .ibm-main {
    padding: 25px 24px 36px;
  }
  .ibm-variant .metric-cell {
    padding: 18px 16px;
  }
}
@media (max-width: 760px) {
  .ibm-app-bar {
    min-height: 52px;
    padding: 0 18px;
  }
  .ibm-app-description {
    display: none;
  }
  .ibm-workspace {
    display: flex;
    flex-direction: column;
  }
  .ibm-sidebar {
    display: block;
    padding: 0;
    border-right: 0;
    border-bottom: 1px solid var(--v-line);
  }
  .ibm-project-context,
  .ibm-scope {
    display: none;
  }
  .ibm-navigation {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .ibm-navigation button {
    justify-content: center;
    gap: 6px;
    padding: 14px 4px 11px;
    border-left: 0;
    border-bottom: 3px solid transparent;
    white-space: nowrap;
    font-size: 12px;
  }
  .ibm-navigation button.active {
    border-bottom-color: var(--v-accent);
  }
  .ibm-navigation svg {
    width: 16px;
    height: 16px;
  }
  .ibm-main {
    flex: 1;
    padding: 24px 18px 32px;
  }
  .ibm-variant {
    --v-title-size: 26px;
  }
  .ibm-variant .content-heading {
    margin-bottom: 22px;
  }
  .ibm-variant .overview-grid {
    gap: 14px;
  }
  .ibm-variant .metric-cell {
    padding: 16px;
  }
}
@media (max-width: 640px) {
  .ibm-variant {
    min-height: calc(100svh - 136px);
  }
  .ibm-variant .metric-cell + .metric-cell {
    border-left: 0;
    border-top: 1px solid var(--v-line);
  }
}
@media (max-width: 380px) {
  .ibm-main {
    padding-inline: 14px;
  }
  .ibm-navigation button {
    flex-direction: column;
    gap: 5px;
    padding-block: 10px 8px;
  }
}
</style>
