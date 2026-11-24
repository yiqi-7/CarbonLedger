<script setup lang="ts">
import { computed } from 'vue'

export type BarItem = { label: string; value: number; color?: string }

const props = withDefaults(
  defineProps<{ items: BarItem[]; unit?: string; digits?: number; emptyText?: string }>(),
  { unit: 'tCO₂e', digits: 3, emptyText: '当前阶段暂无排放记录' },
)

const WIDTH = 520
const HEIGHT = 200
const PADDING = { top: 16, right: 12, bottom: 34, left: 12 }

const visible = computed(() => props.items.filter(item => Number.isFinite(item.value)).slice(0, 10))
const hasNegative = computed(() => visible.value.some(item => item.value < 0))

const maxAbs = computed(() => {
  const values = visible.value.map(item => Math.abs(item.value))
  return values.length ? Math.max(...values, 1e-9) : 1
})

const plotWidth = computed(() => WIDTH - PADDING.left - PADDING.right)
const plotHeight = computed(() => HEIGHT - PADDING.top - PADDING.bottom)
const zeroY = computed(() => {
  if (!hasNegative.value) return HEIGHT - PADDING.bottom
  const positiveMax = Math.max(0, ...visible.value.map(item => item.value))
  const negativeMax = Math.max(0, ...visible.value.map(item => -item.value))
  const total = positiveMax + negativeMax
  if (total <= 0) return HEIGHT - PADDING.bottom
  return PADDING.top + (plotHeight.value * positiveMax) / total
})

const bars = computed(() => {
  const count = visible.value.length || 1
  const slot = plotWidth.value / count
  const barWidth = Math.max(6, Math.min(46, slot * 0.55))
  return visible.value.map((item, index) => {
    const height = (Math.abs(item.value) / maxAbs.value) * (hasNegative.value ? Math.min(zeroY.value - PADDING.top, HEIGHT - PADDING.bottom - zeroY.value) : plotHeight.value)
    const safeHeight = Math.max(item.value === 0 ? 0 : 1, height)
    const x = PADDING.left + slot * index + (slot - barWidth) / 2
    const y = item.value >= 0 ? zeroY.value - safeHeight : zeroY.value
    return {
      ...item,
      x,
      y,
      width: barWidth,
      height: safeHeight,
      centerX: x + barWidth / 2,
      negative: item.value < 0,
      labelY: HEIGHT - PADDING.bottom + 18,
    }
  })
})

function formatValue(value: number) {
  return Number(value).toLocaleString('zh-CN', {
    minimumFractionDigits: props.digits,
    maximumFractionDigits: props.digits,
  })
}
</script>

<template>
  <div class="bar-chart-wrap">
    <svg
      v-if="visible.length"
      class="bar-chart"
      :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      :aria-label="`分布图，单位 ${unit}`"
    >
      <line
        :x1="PADDING.left"
        :x2="WIDTH - PADDING.right"
        :y1="zeroY"
        :y2="zeroY"
        stroke="#dfe6e8"
        stroke-width="1"
      />
      <g v-for="bar in bars" :key="bar.label">
        <rect
          :x="bar.x"
          :y="bar.y"
          :width="bar.width"
          :height="bar.height"
          :fill="bar.negative ? '#67bd79' : bar.color || '#55add8'"
          rx="3"
        >
          <title>{{ bar.label }}：{{ formatValue(bar.value) }} {{ unit }}</title>
        </rect>
        <text
          class="bar-value"
          :x="bar.centerX"
          :y="bar.negative ? bar.y + bar.height + 12 : bar.y - 5"
          text-anchor="middle"
        >
          {{ formatValue(bar.value) }}
        </text>
        <text class="bar-label" :x="bar.centerX" :y="bar.labelY" text-anchor="middle">
          {{ bar.label.length > 7 ? `${bar.label.slice(0, 7)}…` : bar.label }}
        </text>
      </g>
    </svg>
    <p v-else class="muted empty-chart">{{ emptyText }}</p>
  </div>
</template>