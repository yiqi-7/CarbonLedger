<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import StyleShell from './StyleShell.vue'
import { providePreview } from '../design-preview/state'
import type { PageId } from '../design-preview/types'

type ThemeId = 'soft-utility' | 'graphite-editorial' | 'cloud-blue' | 'indigo-grid' | 'swiss-international' | 'brutalist-web' | 'japanese-editorial' | 'y2k-digital' | 'crt-terminal' | 'neo-memphis' | 'aurora-glass' | 'monochrome-luxury' | 'paper-cut' | 'arcade-utility'

const themes: { id: ThemeId; letter: string; name: string; detail: string }[] = [
  { id: 'soft-utility', letter: 'D', name: 'Soft Utility', detail: '柔和工具界面（保留）' },
  { id: 'graphite-editorial', letter: 'E', name: 'Graphite Editorial', detail: '石墨编辑系统（保留）' },
  { id: 'cloud-blue', letter: 'I', name: 'Cloud Blue', detail: '云端蓝灰（保留）' },
  { id: 'indigo-grid', letter: 'L', name: 'Indigo Grid', detail: '靛蓝网格系统（保留）' },
  { id: 'swiss-international', letter: 'N', name: 'Swiss International', detail: '瑞士国际主义' },
  { id: 'brutalist-web', letter: 'O', name: 'Brutalist Web', detail: '网页粗野主义' },
  { id: 'japanese-editorial', letter: 'P', name: 'Japanese Editorial', detail: '日式编辑排版' },
  { id: 'y2k-digital', letter: 'Q', name: 'Y2K Digital', detail: '千禧年数字界面' },
  { id: 'crt-terminal', letter: 'R', name: 'CRT Terminal', detail: 'CRT 终端荧光' },
  { id: 'neo-memphis', letter: 'S', name: 'Neo Memphis', detail: '新孟菲斯构成' },
  { id: 'aurora-glass', letter: 'T', name: 'Aurora Glass', detail: '极光玻璃层' },
  { id: 'monochrome-luxury', letter: 'U', name: 'Monochrome Luxury', detail: '黑白奢侈品' },
  { id: 'paper-cut', letter: 'V', name: 'Paper Cut', detail: '纸张剪贴构成' },
  { id: 'arcade-utility', letter: 'W', name: 'Arcade Utility', detail: '街机工具界面' },
]

const pages: { id: PageId; name: string }[] = [
  { id: 'overview', name: '项目概览' },
  { id: 'materials', name: '建材清单' },
  { id: 'project', name: '项目信息' },
  { id: 'projects', name: '项目目录' },
  { id: 'login', name: '登录页' },
]

providePreview()
const theme = ref<ThemeId>('soft-utility')
const page = ref<PageId>('overview')

function readUrl() {
  const query = new URLSearchParams(location.search)
  const candidateTheme = query.get('theme')
  const candidatePage = query.get('page')
  theme.value = themes.find(item => item.id === candidateTheme)?.id ?? 'soft-utility'
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
