<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Check, TopRight } from '@element-plus/icons-vue'
import CarbonVariant from './variants/CarbonVariant.vue'
import IbmVariant from './variants/IbmVariant.vue'
import SapVariant from './variants/SapVariant.vue'
import NotionVariant from './variants/NotionVariant.vue'
import StripeVariant from './variants/StripeVariant.vue'
import OuraVariant from './variants/OuraVariant.vue'
import FigmaVariant from './variants/FigmaVariant.vue'
import WiredVariant from './variants/WiredVariant.vue'
import ClayVariant from './variants/ClayVariant.vue'
import { providePreview } from './state'
import type { PageId, StyleId } from './types'

const state = providePreview()
const styles = [
  { id: 'carbon', letter: 'A', name: 'Carbon', detail: '当前风格', component: CarbonVariant },
  { id: 'ibm', letter: 'B', name: 'IBM', detail: '精密工作台', component: IbmVariant },
  { id: 'sap', letter: 'C', name: 'SAP', detail: '业务管理台', component: SapVariant },
  { id: 'notion', letter: 'D', name: 'Notion', detail: '轻量文档式', component: NotionVariant },
  { id: 'stripe', letter: 'E', name: 'Stripe', detail: '清晰分析台', component: StripeVariant },
  { id: 'oura', letter: 'F', name: 'Oura', detail: '建筑画册', component: OuraVariant },
  { id: 'figma', letter: 'G', name: 'Figma', detail: '色块构成', component: FigmaVariant },
  { id: 'wired', letter: 'H', name: 'WIRED', detail: '黑白刊物', component: WiredVariant },
  { id: 'clay', letter: 'I', name: 'Clay', detail: '艺术工作室', component: ClayVariant },
] as const
const pages: { id: PageId; name: string }[] = [
  { id: 'overview', name: '项目概览' }, { id: 'materials', name: '建材清单' },
  { id: 'project', name: '项目信息' }, { id: 'projects', name: '项目目录' }, { id: 'login', name: '登录页' },
]
const style = ref<StyleId>('carbon')
const page = ref<PageId>('overview')
function readUrl() {
  const query = new URLSearchParams(location.search)
  const candidate = query.get('style')
  const candidatePage = query.get('page')
  style.value = styles.find(item => item.id === candidate)?.id ?? 'carbon'
  page.value = pages.find(item => item.id === candidatePage)?.id ?? 'overview'
}
readUrl()
window.addEventListener('popstate', readUrl)
onBeforeUnmount(() => window.removeEventListener('popstate', readUrl))
const activeStyle = computed(() => styles.find(item => item.id === style.value)!)
const artistic = computed(() => ['oura', 'figma', 'wired', 'clay'].includes(style.value))
const visibleStyles = computed(() => artistic.value ? styles.slice(5) : styles.slice(0, 5))
const labRoot = ref<HTMLElement>()
const toolbar = ref<HTMLElement>()
let toolbarObserver: ResizeObserver | undefined
onMounted(() => {
  toolbarObserver = new ResizeObserver(entries => {
    const height = entries[0]?.target.getBoundingClientRect().height
    if (height) labRoot.value?.style.setProperty('--lab-toolbar-height', `${height}px`)
  })
  if (toolbar.value) toolbarObserver.observe(toolbar.value)
})
onBeforeUnmount(() => toolbarObserver?.disconnect())
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
  <div ref="labRoot" class="design-lab">
    <header ref="toolbar" class="lab-toolbar" aria-label="设计方案比较工具">
      <div class="lab-title"><div><strong>方案对比</strong><span>示例数据</span></div><div class="lab-families" role="group" aria-label="方案分组"><button :aria-pressed="!artistic" @click="navigate(page, 'carbon')">工作台 A–E</button><button :aria-pressed="artistic" @click="navigate(page, 'oura')">艺术 F–I</button></div></div>
      <div class="lab-variants" role="group" aria-label="选择设计方案">
        <button v-for="item in visibleStyles" :key="item.id" :aria-label="`${item.letter} ${item.name} ${item.detail}`" :aria-pressed="style === item.id" :class="{ selected: style === item.id }" @click="navigate(page, item.id)">
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
