import { computed, inject, provide, reactive, ref, type InjectionKey } from 'vue'
import type { Material } from './types'

function createPreviewState() {
  const project = reactive({
    name: '西溪科创园办公楼', location: '浙江省杭州市', type: '公共建筑',
    area: 28600, manager: '陈工', standard: 'GB/T 51366—2019',
  })
  const materials = ref<Material[]>([
    { id: 1, name: '预拌混凝土 C30', type: '混凝土', quantity: 8470, unit: 'm³', factor: 326, price: 420 },
    { id: 2, name: '热轧带肋钢筋 HRB400', type: '钢材', quantity: 1560, unit: 't', factor: 2050, price: 3650 },
    { id: 3, name: '蒸压加气混凝土砌块', type: '砌体', quantity: 2280, unit: 'm³', factor: 178, price: 280 },
    { id: 4, name: '铝合金窗', type: '门窗', quantity: 3160, unit: 'm²', factor: 78.5, price: 680 },
  ])
  const materialEmission = computed(() => materials.value.reduce((sum, row) => sum + row.quantity * row.factor / 1000, 0))
  const totalEmission = computed(() => materialEmission.value + 368.4 + 184.6)
  const netEmission = computed(() => totalEmission.value - 48.9)
  const totalCost = computed(() => materials.value.reduce((sum, row) => sum + row.quantity * row.price / 10000, 0))
  const stages = computed(() => [
    { name: '建材生产', value: materialEmission.value },
    { name: '建材运输', value: 368.4 },
    { name: '现场施工', value: 184.6 },
  ])
  const notice = ref('')
  let noticeTimer: ReturnType<typeof setTimeout> | undefined
  function notify(message: string) {
    notice.value = message
    clearTimeout(noticeTimer)
    noticeTimer = setTimeout(() => { notice.value = '' }, 4500)
  }
  function saveMaterial(material: Material) {
    const index = materials.value.findIndex(row => row.id === material.id)
    if (index >= 0) materials.value[index] = { ...material }
    else materials.value.push({ ...material, id: Math.max(0, ...materials.value.map(row => row.id)) + 1 })
    notify('示例清单已更新，核算结果已重新计算。')
  }
  return { project, materials, materialEmission, totalEmission, netEmission, totalCost, stages, notice, notify, saveMaterial }
}

const previewKey: InjectionKey<ReturnType<typeof createPreviewState>> = Symbol('design-preview')
export function providePreview() {
  const state = createPreviewState()
  provide(previewKey, state)
  return state
}
export function usePreview() {
  const state = inject(previewKey)
  if (!state) throw new Error('Design preview provider is missing')
  return state
}
export const formatNumber = (value: number, digits = 2) => new Intl.NumberFormat('zh-CN', {
  minimumFractionDigits: digits, maximumFractionDigits: digits,
}).format(value)
