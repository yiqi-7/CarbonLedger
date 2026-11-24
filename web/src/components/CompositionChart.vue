<script setup lang="ts">
import { computed } from 'vue'
import { compositionShares, type BarItem } from '@/utils/chart'

const props = withDefaults(
  defineProps<{ items: BarItem[]; unit?: string; emptyText?: string; digits?: number }>(),
  { unit: '万元', emptyText: '暂无成本数据', digits: 2 },
)

const palette = ['#4d8fe9', '#69c4c7', '#63b36c', '#eba943', '#a777d2', '#e5715e']

const shares = computed(() => compositionShares(props.items.slice(0, 6)))
const total = computed(() => props.items.slice(0, 6).reduce((sum, item) => sum + Math.max(0, item.value), 0))

const gradient = computed(() => {
  if (!shares.value.length) return 'conic-gradient(#e9eef0 0deg 360deg)'
  let start = 0
  const stops = shares.value.map((item, index) => {
    const end = start + (item.share / 100) * 360
    const stop = `${palette[index % palette.length]} ${start.toFixed(2)}deg ${end.toFixed(2)}deg`
    start = end
    return stop
  })
  return `conic-gradient(${stops.join(', ')})`
})

function formatValue(value: number) {
  return Number(value || 0).toLocaleString('zh-CN', {
    minimumFractionDigits: props.digits,
    maximumFractionDigits: props.digits,
  })
}
</script>

<template>
  <div v-if="shares.length" class="composition-wrap">
    <div class="composition-donut" :style="{ background: gradient }" role="img" :aria-label="`成本构成，合计 ${formatValue(total)} ${unit}`">
      <div class="composition-hole">
        <strong>{{ formatValue(total) }}</strong>
        <small>{{ unit }}</small>
      </div>
    </div>
    <ul class="composition-legend">
      <li v-for="(item, index) in shares" :key="item.label">
        <i :style="{ background: palette[index % palette.length] }" />
        <span class="composition-label">{{ item.label }}</span>
        <span class="composition-share">{{ item.share.toFixed(1) }}%</span>
        <span class="composition-value">{{ formatValue(item.value) }}</span>
      </li>
    </ul>
  </div>
  <p v-else class="muted empty-chart">{{ emptyText }}</p>
</template>
