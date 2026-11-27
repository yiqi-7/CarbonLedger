<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import StyleShell from './StyleShell.vue'
import { providePreview } from '../design-preview/state'
import type { PageId } from '../design-preview/types'

type ThemeId = 'swiss' | 'carbon-dark' | 'architect' | 'nordic' | 'print' | 'terminal' | 'bauhaus' | 'biophilic' | 'cobalt' | 'museum' | 'brutalist'

const themes: { id: ThemeId; letter: string; name: string; detail: string }[] = [
  { id: 'swiss', letter: 'A', name: 'Swiss Data', detail: '瑞士数据排版' },
  { id: 'carbon-dark', letter: 'B', name: 'Carbon Instrument', detail: '深色仪表' },
  { id: 'architect', letter: 'C', name: 'Architect Neutral', detail: '建筑暖中性' },
  { id: 'nordic', letter: 'D', name: 'Nordic Frost', detail: '北欧冷调' },
  { id: 'print', letter: 'E', name: 'Editorial Print', detail: '印刷刊物' },
  { id: 'terminal', letter: 'F', name: 'Data Terminal', detail: '数据终端' },
  { id: 'bauhaus', letter: 'G', name: 'Bauhaus Signal', detail: '包豪斯信号' },
  { id: 'biophilic', letter: 'H', name: 'Biophilic Ledger', detail: '生态账本' },
  { id: 'cobalt', letter: 'I', name: 'Cobalt Editorial', detail: '钴蓝编辑部' },
  { id: 'museum', letter: 'J', name: 'Museum Paper', detail: '博物馆纸张' },
  { id: 'brutalist', letter: 'K', name: 'Grid Brutalist', detail: '网格粗野主义' },
]

const pages: { id: PageId; name: string }[] = [
  { id: 'overview', name: '项目概览' },
  { id: 'materials', name: '建材清单' },
  { id: 'project', name: '项目信息' },
  { id: 'projects', name: '项目目录' },
  { id: 'login', name: '登录页' },
]

providePreview()
const theme = ref<ThemeId>('swiss')
const page = ref<PageId>('overview')

function readUrl() {
  const query = new URLSearchParams(location.search)
  const candidateTheme = query.get('theme')
  const candidatePage = query.get('page')
  theme.value = themes.find(item => item.id === candidateTheme)?.id ?? 'swiss'
  page.value = pages.find(item => item.id === candidatePage)?.id ?? 'overview'
}
readUrl()
window.addEventListener('popstate', readUrl)

const activeTheme = computed(() => themes.find(item => item.id === theme.value)!)

function navigate(nextPage: PageId = page.value, nextTheme: ThemeId = theme.value) {
  page.value = nextPage
  theme.value = nextTheme
  const url = new URL(location.href)
  url.searchParams.set('theme', nextTheme)
  url.searchParams.set('page', nextPage)
  history.replaceState({}, '', url)
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
}

watch([theme, page], () => {
  document.title = `${activeTheme.value.name} · ${pages.find(item => item.id === page.value)?.name} · 界面风格对照`
}, { immediate: true })
</script>

<template>
  <div class="style-lab">
    <header class="lab-bar">
      <div class="lab-bar-title">
        <strong>界面风格对照</strong>
        <span>同一套布局与内容，仅替换视觉风格</span>
      </div>
      <div class="lab-bar-themes" role="group" aria-label="选择风格">
        <button
          v-for="item in themes"
          :key="item.id"
          type="button"
          :class="{ selected: theme === item.id }"
          :aria-pressed="theme === item.id"
          :aria-label="`${item.letter} ${item.name} ${item.detail}`"
          @click="navigate(page, item.id)"
        >
          <span class="lab-bar-letter">{{ item.letter }}</span>
          <span class="lab-bar-copy"><b>{{ item.name }}</b><small>{{ item.detail }}</small></span>
        </button>
      </div>
      <div class="lab-bar-pages">
        <label>
          <span class="sr-only">预览页面</span>
          <select :value="page" @change="navigate(($event.target as HTMLSelectElement).value as PageId)">
            <option v-for="item in pages" :key="item.id" :value="item.id">{{ item.name }}</option>
          </select>
        </label>
      </div>
    </header>

    <div class="lab-stage" :data-theme="theme">
      <StyleShell :page="page" @navigate="navigate($event)" />
    </div>
  </div>
</template>
