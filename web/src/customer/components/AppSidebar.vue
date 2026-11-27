<script setup>
import {
  ArrowLeft, ArrowRight, Box, DataAnalysis, Document, House,
  OfficeBuilding, Refresh, Tools, TrendCharts, Van
} from '@element-plus/icons-vue'

defineProps({
  activePage: { type: String, default: '项目信息' },
  navigation: { type: Array, default: () => [] },
  collapsed: { type: Boolean, default: false }
})

const emit = defineEmits(['navigate', 'toggle', 'exit'])

const icons = [House, Document, Box, Van, Tools, Refresh, DataAnalysis, TrendCharts]
const labels = { '首页': '项目概览', '回收碳计算': '回收减碳', '碳排放分析': '排放分析' }
</script>

<template>
  <aside class="sidebar" :class="{ 'sidebar-collapsed': collapsed }">
    <a
      class="brand"
      href="#"
      aria-label="碳建智算平台首页"
      title="碳建智算平台首页"
      @click.prevent="emit('navigate', '首页')"
    >
      <span class="brand-mark" aria-hidden="true"><OfficeBuilding class="brand-icon" /></span>
      <span class="brand-copy"><strong>碳建智算平台</strong></span>
    </a>

    <nav class="sidebar-nav" aria-label="主导航">
      <button
        v-for="(item, index) in navigation"
        :key="item"
        class="nav-item"
        :class="{ active: activePage === item }"
        :aria-label="labels[item] || item"
        :title="labels[item] || item"
        :aria-current="activePage === item ? 'page' : undefined"
        @click="emit('navigate', item)"
      >
        <span class="nav-icon" aria-hidden="true"><component :is="icons[index]" /></span>
        <span>{{ labels[item] || item }}</span>
      </button>
    </nav>

    <a class="project-directory-link" href="/projects" title="返回我的项目" aria-label="返回我的项目" @click.prevent="emit('exit')">
      <ArrowLeft class="directory-icon" aria-hidden="true" /><span class="project-directory-label">返回我的项目</span>
    </a>

  </aside>

  <button
    class="sidebar-toggle"
    :class="{ 'sidebar-toggle-collapsed': collapsed }"
    type="button"
    :aria-label="collapsed ? '展开导航栏' : '隐藏导航栏'"
    :title="collapsed ? '展开导航栏' : '隐藏导航栏'"
    @click="emit('toggle')"
  >
    <span class="sidebar-toggle-icon" aria-hidden="true"><component :is="collapsed ? ArrowRight : ArrowLeft" /></span>
  </button>
</template>

<style scoped>
.brand-icon { width: 20px; height: 20px; }
.sidebar-toggle {
  position: fixed !important;
  left: 14px !important;
  bottom: 18px !important;
  z-index: 1001 !important;
  display: flex !important;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  min-height: 32px;
  margin: 0 !important;
  padding: 0;
  border: 1px solid rgba(37, 65, 74, 0.14);
  border-radius: 999px;
  background: #F5F5F7;
  color: #3D4E4E;
  box-shadow: 0 4px 14px rgba(19, 37, 41, 0.16);
  pointer-events: auto;
}
.sidebar-toggle:hover { background: #E8F2FC; border-color: rgba(0, 113, 227, 0.30); color: #0071E3; }
.sidebar-toggle:focus-visible { outline: 2px solid #0071E3; outline-offset: 3px; }
.sidebar-toggle-icon { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }

.nav-icon svg, .sidebar-toggle-icon svg { width: 1em; height: 1em; }
.directory-icon { width: 16px; height: 16px; flex-shrink: 0; }
.project-directory-link {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  margin-top: 18px;
  padding: 7px 14px;
  border: 1px solid rgba(37, 65, 74, 0.12);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.56);
  color: var(--muted, #566666);
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;
  transition: background-color 0.16s ease, color 0.16s ease, border-color 0.16s ease, transform 500ms cubic-bezier(0.25, 0.1, 0.25, 1);
}
.project-directory-link:hover { background: rgba(255, 255, 255, 0.90); color: var(--primary, #25414A); border-color: rgba(85, 123, 121, 0.35); }
.project-directory-link:focus-visible { outline: 2px solid var(--color-focus, #557B79); outline-offset: 3px; }
.sidebar-collapsed .project-directory-link {
  position: fixed;
  top: 12px;
  left: 14px;
  z-index: 6;
  margin: 0;
}
@media (max-width: 760px) {
  .sidebar:not(.sidebar-collapsed) .project-directory-label { display: none; }
  .sidebar-collapsed .project-directory-link { top: 9px; left: 8px; font-size: 12px; }
}
/* Apple style sidebar refinements */
.brand-mark { background: #000000; border-radius: 50%; box-shadow: none; }
.project-directory-link { background: #F5F5F7; border: 0; border-radius: 999px; color: #6E6E73; transition: transform 500ms cubic-bezier(0.25, 0.1, 0.25, 1), background-color 500ms cubic-bezier(0.25, 0.1, 0.25, 1); }
.project-directory-link:hover { background: #E8F2FC; color: #0071E3; border: 0; }
.project-directory-link:active { transform: scale(0.96); transition-duration: 110ms; }
.project-directory-link:focus-visible { outline-color: #0071E3; }
</style>
