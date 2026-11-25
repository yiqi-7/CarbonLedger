<script setup>
import {
  ArrowLeft, ArrowRight, Box, DataAnalysis, Document, House,
  OfficeBuilding, Refresh, Tools, TrendCharts, Van
} from '@element-plus/icons-vue'

defineProps({
  activePage: { type: String, default: '项目信息' },
  navigation: { type: Array, default: () => [] },
  navigationLocked: { type: Boolean, default: false },
  collapsed: { type: Boolean, default: false }
})

const emit = defineEmits(['navigate', 'toggle', 'exit'])

const icons = [House, Document, Box, Van, Tools, Refresh, DataAnalysis, TrendCharts]
</script>

<template>
  <aside class="sidebar" :class="{ 'sidebar-collapsed': collapsed }">
    <a
      class="brand"
      :class="{ 'navigation-locked': navigationLocked }"
      href="#"
      aria-label="碳建智算平台首页"
      title="碳建智算平台首页"
      :aria-disabled="navigationLocked ? 'true' : undefined"
      @click.prevent="!navigationLocked && emit('navigate', '首页')"
    >
      <span class="brand-mark" aria-hidden="true"><OfficeBuilding class="brand-icon" /></span>
      <span class="brand-copy"><strong>碳建智算平台</strong><small>CarbonBuild</small></span>
    </a>

    <nav class="sidebar-nav" aria-label="主导航">
      <button
        v-for="(item, index) in navigation"
        :key="item"
        class="nav-item"
        :class="{ active: activePage === item }"
        :aria-label="item"
        :title="item"
        :aria-current="activePage === item ? 'page' : undefined"
        :disabled="navigationLocked"
        @click="emit('navigate', item)"
      >
        <span class="nav-icon" aria-hidden="true"><component :is="icons[index]" /></span>
        <span>{{ item }}</span>
      </button>
    </nav>

    <a class="project-directory-link" href="/projects" title="返回我的项目" aria-label="返回我的项目" @click.prevent="emit('exit')">
      <ArrowLeft class="directory-icon" aria-hidden="true" /><span class="project-directory-label">返回我的项目</span>
    </a>

    <button
      class="sidebar-toggle"
      type="button"
      :aria-label="collapsed ? '展开导航栏' : '隐藏导航栏'"
      :title="collapsed ? '展开导航栏' : '隐藏导航栏'"
      @click="emit('toggle')"
    >
      <span class="sidebar-toggle-icon" aria-hidden="true"><component :is="collapsed ? ArrowRight : ArrowLeft" /></span>
    </button>
  </aside>
</template>

<style scoped>
.brand-icon { width: 20px; height: 20px; }
.nav-icon, .sidebar-toggle-icon { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
.nav-icon svg, .sidebar-toggle-icon svg { width: 1em; height: 1em; }
.directory-icon { width: 16px; height: 16px; flex-shrink: 0; }
.project-directory-link {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 36px;
  margin-top: 18px;
  padding: 7px 10px;
  border: 1px solid #315279;
  border-radius: 6px;
  background: #142c4b;
  color: #c1d8f4;
  font-size: 13px;
  text-decoration: none;
}
.project-directory-link:hover { background: #1c3d64; color: #fff; }
.project-directory-link:focus-visible { outline: 2px solid #90c4ff; outline-offset: 3px; }
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
</style>
