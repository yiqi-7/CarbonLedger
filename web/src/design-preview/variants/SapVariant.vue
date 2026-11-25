<script setup lang="ts">
import { ArrowRight, User } from '@element-plus/icons-vue'
import type { PageId } from '../types'
import { usePreview } from '../state'
import PreviewContent from '../PreviewContent.vue'

defineProps<{ page: PageId }>()
const emit = defineEmits<{ navigate: [page: PageId] }>()
const state = usePreview()
const navigation = [
  { id: 'overview' as const, label: '项目概览' },
  { id: 'materials' as const, label: '建材清单' },
  { id: 'project' as const, label: '项目信息' },
  { id: 'projects' as const, label: '项目目录' },
]
</script>

<template>
  <div class="sap-variant" :class="{ 'is-login': page === 'login' }">
    <header v-if="page !== 'login'" class="sap-shell-bar">
      <div class="sap-shell-inner">
        <button class="sap-brand" type="button" @click="emit('navigate', 'overview')">
          <span class="sap-brand-rule" aria-hidden="true"></span>
          碳建智算平台
        </button>
        <span class="sap-shell-label">工程碳排放核算</span>
        <button
          class="sap-account"
          type="button"
          @click="emit('navigate', 'login')"
        >
          <User aria-hidden="true" />
          <span>登录</span>
        </button>
      </div>
    </header>

    <template v-if="page !== 'login'">
      <div class="sap-context-band">
        <div class="sap-context-inner">
          <div class="sap-breadcrumb" aria-label="当前项目">
            <button type="button" @click="emit('navigate', 'projects')">我的项目</button>
            <ArrowRight aria-hidden="true" />
            <span>{{ state.project.name }}</span>
          </div>
          <span class="sap-scope-label">建造阶段</span>
        </div>
      </div>
      <nav class="sap-tab-bar" aria-label="项目功能">
        <div class="sap-tab-inner">
          <button
            v-for="item in navigation"
            :key="item.id"
            type="button"
            :class="{ active: page === item.id }"
            :aria-current="page === item.id ? 'page' : undefined"
            @click="emit('navigate', item.id)"
          >
            {{ item.label }}
          </button>
        </div>
      </nav>
    </template>

    <main class="variant-body sap-main">
      <PreviewContent :page="page" @navigate="emit('navigate', $event)" />
    </main>
  </div>
</template>

<style>
.sap-variant {
  --v-bg: #f5f6f7;
  --v-surface: #fff;
  --v-text: #223548;
  --v-muted: #475e75;
  --v-line: #d5dadd;
  --v-accent: #0057d2;
  --v-tint: #ebf8ff;
  --v-radius: 8px;
  --v-font: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  --v-title-weight: 600;
  --v-title-size: 30px;
  display: flex;
  flex-direction: column;
  min-height: calc(100svh - 96px);
  background: var(--v-bg);
  color: var(--v-text);
  font-family: var(--v-font);
  font-size: 15px;
}
.sap-variant button,
.sap-variant input,
.sap-variant select {
  font: inherit;
}
.sap-variant button:focus-visible,
.sap-variant a:focus-visible {
  outline: 2px solid #0057d2;
  outline-offset: 3px;
}
.sap-shell-bar {
  background: #f5f6f7;
  border-bottom: 1px solid #d5dadd;
}
.sap-shell-inner {
  display: flex;
  align-items: center;
  min-height: 60px;
  max-width: 1440px;
  margin: 0 auto;
  padding: 0 40px;
}
.sap-brand {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  border: 0;
  padding: 8px 0;
  background: transparent;
  color: #102a43;
  font-size: 19px !important;
  font-weight: 700 !important;
  cursor: pointer;
  white-space: nowrap;
}
.sap-brand-rule {
  display: block;
  width: 5px;
  height: 25px;
  border-radius: 1px;
  background: #0057d2;
}
.sap-shell-label {
  margin-left: 34px;
  padding-left: 27px;
  border-left: 1px solid #c5ccd2;
  color: #475e75;
  font-size: 14px;
}
.sap-account {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  margin-left: auto;
  padding: 7px 12px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: #0057d2;
  cursor: pointer;
}
.sap-account:hover {
  border-color: #bccbda;
  background: #eaecee;
}
.sap-account svg {
  width: 18px;
  height: 18px;
}
.sap-context-band {
  background: #fff;
}
.sap-context-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  max-width: 1440px;
  min-height: 64px;
  margin: 0 auto;
  padding: 14px 40px;
}
.sap-breadcrumb {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  font-size: 14px;
  line-height: 1.6;
}
.sap-breadcrumb button {
  flex-shrink: 0;
  padding: 4px 0;
  border: 0;
  background: transparent;
  color: #0057d2;
  cursor: pointer;
}
.sap-breadcrumb button:hover {
  text-decoration: underline;
}
.sap-breadcrumb svg {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  color: #8396a8;
}
.sap-breadcrumb span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #223548;
}
.sap-scope-label {
  flex-shrink: 0;
  border-left: 1px solid #d5dadd;
  padding-left: 22px;
  color: #475e75;
  font-size: 13px;
}
.sap-tab-bar {
  border-bottom: 1px solid #bcc8d1;
  background: #fff;
}
.sap-tab-inner {
  display: flex;
  gap: 30px;
  max-width: 1440px;
  margin: 0 auto;
  padding: 0 40px;
}
.sap-tab-inner button {
  position: relative;
  flex-shrink: 0;
  min-height: 49px;
  border: 0;
  border-bottom: 3px solid transparent;
  padding: 8px 3px 14px;
  background: transparent;
  color: #354a5f;
  cursor: pointer;
}
.sap-tab-inner button.active {
  border-bottom-color: #0057d2;
  color: #0057d2;
  font-weight: 600;
}
.sap-tab-inner button:hover {
  color: #0040b0;
}
.sap-main {
  flex: 1;
  width: 100%;
  min-width: 0;
  max-width: 1440px;
  margin: 0 auto;
  padding: 30px 40px 44px;
}
.sap-variant .content-heading {
  align-items: center;
  margin-bottom: 24px;
}
.sap-variant .content-heading h1 {
  color: #102a43;
  letter-spacing: -.02em;
  line-height: 1.3;
}
.sap-variant .content-heading p {
  color: #475e75;
  font-size: 14px;
  line-height: 1.6;
}
.sap-variant .overview-grid {
  grid-template-columns: minmax(0, 1.45fr) minmax(0, 1fr);
  gap: 22px;
}
.sap-variant .metrics-strip {
  grid-column: 1 / -1;
  border: 0;
  border-radius: 0;
  background: #ebf8ff;
}
.sap-variant .metric-cell {
  padding: 25px 28px;
}
.sap-variant .metric-cell + .metric-cell {
  border-left: 1px solid #c4dce8;
}
.sap-variant .metric-cell strong {
  color: #022879;
  font-weight: 500;
  letter-spacing: -.035em;
}
.sap-variant .stage-panel,
.sap-variant .ledger-panel,
.sap-variant .project-summary {
  border: 0;
  border-radius: 0;
  background: #fff;
  box-shadow: none;
}
.sap-variant .panel-heading {
  margin-bottom: 0;
}
.sap-variant .panel-heading h2 {
  color: #223548;
  font-size: 18px;
  font-weight: 600;
}
.sap-variant .ledger-panel {
  grid-column: 1 / -1;
  order: 4;
}
.sap-variant .project-summary {
  order: 3;
}
.sap-variant .stage-panel {
  order: 2;
}
.sap-variant .stage-bars {
  gap: 18px;
}
.sap-variant .preview-table {
  font-size: 14px;
}
.sap-variant .preview-table th {
  background: #eaecee;
  color: #354a5f;
  font-weight: 600;
}
.sap-variant .preview-table th,
.sap-variant .preview-table td {
  padding: 14px 18px;
  border-bottom: 1px solid #dbe0e4;
}
.sap-variant .preview-table tbody tr:hover {
  background: #f1f8fc;
}
.sap-variant .table-toolbar {
  gap: 14px;
}
.sap-variant .primary-action,
.sap-variant .secondary-action {
  min-height: 40px;
  border-radius: 8px;
  padding: 9px 18px;
  font-weight: 600;
}
.sap-variant .primary-action:hover {
  background: #0040b0;
}
.sap-variant .secondary-action {
  border-color: #bcc8d1;
  color: #0057d2;
  background: #fff;
}
.sap-variant .secondary-action:hover {
  border-color: #0057d2;
  background: #ebf8ff;
}
.sap-variant .preview-field input,
.sap-variant .preview-field select,
.sap-variant .preview-field textarea,
.sap-variant .table-toolbar input,
.sap-variant .table-toolbar select {
  border: 1px solid #899eaf;
  border-radius: 6px;
  background: #fff;
}
.sap-variant .field-grid {
  column-gap: 32px;
  row-gap: 22px;
}
.sap-variant.is-login .sap-main {
  display: grid;
  align-items: center;
  padding: 0;
}
@media (max-width: 1000px) {
  .sap-shell-inner,
  .sap-context-inner,
  .sap-tab-inner {
    padding-inline: 28px;
  }
  .sap-main {
    padding: 26px 28px 36px;
  }
  .sap-variant .metric-cell {
    padding: 23px 20px;
  }
}
@media (max-width: 760px) {
  .sap-variant {
    --v-title-size: 26px;
  }
  .sap-shell-inner {
    min-height: 58px;
    padding: 0 18px;
  }
  .sap-brand {
    gap: 9px;
    font-size: 17px !important;
  }
  .sap-shell-label {
    display: none;
  }
  .sap-account {
    padding-inline: 7px;
  }
  .sap-context-inner {
    min-height: 55px;
    padding: 11px 18px;
  }
  .sap-breadcrumb {
    gap: 9px;
    font-size: 12px;
  }
  .sap-scope-label {
    display: none;
  }
  .sap-tab-inner {
    gap: 0;
    padding: 0 12px;
  }
  .sap-tab-inner button {
    flex: 1;
    min-width: 0;
    min-height: 47px;
    padding: 8px 2px 12px;
    font-size: 13px;
    white-space: nowrap;
  }
  .sap-main {
    padding: 23px 18px 32px;
  }
  .sap-variant .overview-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
  }
  .sap-variant .metric-cell {
    padding: 19px 16px;
  }
  .sap-variant .content-heading {
    align-items: flex-start;
  }
  .sap-variant .ledger-panel {
    order: 3;
  }
  .sap-variant .project-summary {
    order: 4;
  }
}
@media (max-width: 640px) {
  .sap-variant {
    min-height: calc(100svh - 136px);
  }
  .sap-variant .metric-cell + .metric-cell {
    border-left: 0;
    border-top: 1px solid #c4dce8;
  }
}
@media (max-width: 380px) {
  .sap-shell-inner,
  .sap-context-inner,
  .sap-main {
    padding-inline: 14px;
  }
  .sap-brand {
    font-size: 16px !important;
  }
  .sap-account {
    gap: 5px;
    font-size: 13px;
  }
}
</style>
