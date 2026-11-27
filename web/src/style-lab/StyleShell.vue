<script setup lang="ts">
import { computed } from 'vue'
import { DataAnalysis, Document, FolderOpened, Setting, User, Van, Tools, RefreshLeft, TrendCharts, Money } from '@element-plus/icons-vue'
import type { PageId } from '../design-preview/types'
import { usePreview } from '../design-preview/state'
import PreviewContent from '../design-preview/PreviewContent.vue'

const props = defineProps<{ page: PageId }>()
const emit = defineEmits<{ navigate: [page: PageId] }>()
const state = usePreview()

type NavItem = { label: string; icon: unknown; page?: PageId }

// Same navigation order and labels as the production workspace.
const navigation: NavItem[] = [
  { label: '项目概览', icon: DataAnalysis, page: 'overview' },
  { label: '建材清单', icon: Document, page: 'materials' },
  { label: '运输清单', icon: Van },
  { label: '施工清单', icon: Tools },
  { label: '回收清单', icon: RefreshLeft },
  { label: '碳排放分析', icon: TrendCharts },
  { label: '成本分析', icon: Money },
  { label: '项目信息', icon: Setting, page: 'project' },
  { label: '项目目录', icon: FolderOpened, page: 'projects' },
]

const pageLabel = computed(() => ({
  overview: '项目概览',
  materials: '建材清单',
  project: '项目信息',
  projects: '项目目录',
  login: '登录',
}[props.page]))

function go(item: NavItem) {
  if (item.page) emit('navigate', item.page)
}
</script>

<template>
  <div class="style-shell">
    <header class="shell-topbar">
      <div class="shell-brand">
        <span class="shell-brand-mark">碳</span>
        <span class="shell-brand-name">碳建智算平台</span>
      </div>
      <div class="shell-crumb">
        <span>项目工作区</span><b>/</b><strong>{{ pageLabel }}</strong>
      </div>
      <div class="shell-account">
        <span class="shell-user"><User aria-hidden="true" />示例账号</span>
        <button class="shell-logout" type="button" @click="emit('navigate', 'login')">退出</button>
      </div>
    </header>

    <div class="shell-body">
      <aside class="shell-sidebar">
        <div class="shell-project">
          <span>当前项目</span>
          <strong>{{ state.project.name }}</strong>
          <small>{{ state.project.location }}</small>
        </div>
        <nav class="shell-nav" aria-label="项目功能">
          <button
            v-for="item in navigation"
            :key="item.label"
            type="button"
            :class="{ active: item.page === page }"
            :aria-current="item.page === page ? 'page' : undefined"
            :disabled="!item.page"
            :title="item.page ? undefined : '风格对照页未包含此页面'"
            @click="go(item)"
          >
            <component :is="item.icon" aria-hidden="true" /><span>{{ item.label }}</span>
          </button>
        </nav>
        <div class="shell-scope">
          <span>核算范围</span>
          <p>建造阶段</p>
          <small>材料 · 运输 · 施工 · 回收</small>
        </div>
      </aside>

      <main class="shell-main">
        <PreviewContent :page="page" @navigate="emit('navigate', $event)" />
      </main>
    </div>
  </div>
</template>
