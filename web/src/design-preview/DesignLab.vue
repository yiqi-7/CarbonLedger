<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { Check, TopRight } from '@element-plus/icons-vue'
import IbmVariant from './variants/IbmVariant.vue'
import SapVariant from './variants/SapVariant.vue'
import NotionVariant from './variants/NotionVariant.vue'
import StripeVariant from './variants/StripeVariant.vue'
import { providePreview } from './state'
import type { PageId, StyleId } from './types'

const state = providePreview()
const styles = [
  { id: 'ibm', letter: 'A', name: 'IBM', detail: '精密工作台', component: IbmVariant },
  { id: 'sap', letter: 'B', name: 'SAP', detail: '业务管理台', component: SapVariant },
  { id: 'notion', letter: 'C', name: 'Notion', detail: '轻量文档式', component: NotionVariant },
  { id: 'stripe', letter: 'D', name: 'Stripe', detail: '清晰分析台', component: StripeVariant },
] as const
const pages: { id: PageId; name: string }[] = [
  { id: 'overview', name: '项目概览' }, { id: 'materials', name: '建材清单' },
  { id: 'project', name: '项目信息' }, { id: 'projects', name: '项目目录' }, { id: 'login', name: '登录页' },
]
const style = ref<StyleId>('ibm')
const page = ref<PageId>('overview')
function readUrl() {
  const query = new URLSearchParams(location.search)
  const candidate = query.get('style')
  const candidatePage = query.get('page')
  style.value = styles.find(item => item.id === candidate)?.id ?? 'ibm'
  page.value = pages.find(item => item.id === candidatePage)?.id ?? 'overview'
}
readUrl()
window.addEventListener('popstate', readUrl)
onBeforeUnmount(() => window.removeEventListener('popstate', readUrl))
const activeStyle = computed(() => styles.find(item => item.id === style.value)!)
watch([page, style], () => {
  document.title = `${activeStyle.value.name} · ${pages.find(item => item.id === page.value)?.name} · 方案对比`
}, { immediate: true })
watch(page, async () => {
  await nextTick()
  const heading = document.querySelector<HTMLElement>('main h1')
  heading?.setAttribute('tabindex', '-1')
  heading?.focus({ preventScroll: true })
})
async function navigate(nextPage: PageId = page.value, nextStyle: StyleId = style.value) {
  page.value = nextPage
  style.value = nextStyle
  const url = new URL(location.href)
  url.searchParams.set('style', style.value)
  url.searchParams.set('page', page.value)
  if (url.href !== location.href) history.pushState({}, '', url)
  await nextTick()
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
}
const preference = ref('')
try { preference.value = localStorage.getItem('carbonledger.design-preference') ?? '' } catch { /* optional local preference */ }
function savePreference() {
  preference.value = style.value
  try {
    localStorage.setItem('carbonledger.design-preference', style.value)
    state.notify(`已标记 ${activeStyle.value.letter} · ${activeStyle.value.name} 为首选，正式界面尚未切换。`)
  } catch { state.notify('已在本次预览中标记首选。') }
}
</script>

<template>
  <div class="design-lab">
    <header class="lab-toolbar" aria-label="设计方案比较工具">
      <div class="lab-title"><strong>方案对比</strong><span>示例数据 · 可试用</span></div>
      <div class="lab-variants" role="group" aria-label="选择设计方案">
        <button v-for="item in styles" :key="item.id" :aria-pressed="style === item.id" :class="{ selected: style === item.id }" @click="navigate(page, item.id)">
          <span class="lab-letter">{{ item.letter }}</span><span><b>{{ item.name }}</b><small>{{ item.detail }}</small></span>
          <Check v-if="preference === item.id" class="lab-check" aria-label="首选方案" />
        </button>
      </div>
      <div class="lab-tools">
        <label class="lab-page"><span class="sr-only">预览页面</span><select :value="page" @change="navigate(($event.target as HTMLSelectElement).value as PageId)"><option v-for="item in pages" :key="item.id" :value="item.id">{{ item.name }}</option></select></label>
        <button class="lab-prefer" @click="savePreference">{{ preference === style ? '已选为首选' : '标记为首选' }}</button>
        <a href="/" class="lab-current" title="打开当前正式界面">当前版<TopRight aria-hidden="true" /></a>
      </div>
    </header>
    <component :is="activeStyle.component" :page="page" @navigate="navigate($event)" />
    <div class="preview-notice" role="status" aria-live="polite">{{ state.notice.value }}</div>
  </div>
</template>
