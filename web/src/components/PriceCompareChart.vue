<script setup lang="ts">
import { computed } from 'vue'
import type { PricePoint } from '@/utils/chart'

const props = withDefaults(
  defineProps<{ items: PricePoint[]; unit?: string; emptyText?: string }>(),
  { unit: '元', emptyText: '暂无建材价格数据' },
)

const WIDTH = 520
const HEIGHT = 210
const PADDING = { top: 18, right: 12, bottom: 38, left: 12 }

const visible = computed(() => props.items.slice(0, 6))

const maxValue = computed(() => {
  const values = visible.value.flatMap(item => [item.marketPrice ?? 0, item.dealPrice])
  return values.length ? Math.max(...values, 1e-9) : 1
})

const plotWidth = computed(() => WIDTH - PADDING.left - PADDING.right)
const plotHeight = computed(() => HEIGHT - PADDING.top - PADDING.bottom)
const baseline = computed(() => HEIGHT - PADDING.bottom)

const groups = computed(() => {
  const count = visible.value.length || 1
  const slot = plotWidth.value / count
  const barWidth = Math.max(5, Math.min(20, (slot * 0.46) / 2))
  return visible.value.map((item, index) => {
    const centerX = PADDING.left + slot * index + slot / 2
    const heightOf = (value: number) => Math.max(value > 0 ? 1 : 0, (value / maxValue.value) * plotHeight.value)
    const dealHeight = heightOf(item.dealPrice)
    const marketHeight = item.marketPrice === null ? 0 : heightOf(item.marketPrice)
    return {
      ...item,
      centerX,
      dealX: item.marketPrice === null ? centerX - barWidth / 2 : centerX + 1,
      dealY: baseline.value - dealHeight,
      dealHeight,
      marketX: centerX - barWidth - 1,
      marketY: baseline.value - marketHeight,
      marketHeight,
      labelY: baseline.value + 18,
    }
  })
})

function formatPrice(value: number) {
  return Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}
</script>

<template>
  <div class="price-chart-wrap">
    <div v-if="visible.length" class="price-legend">
      <span class="price-legend-item"><i class="price-swatch market" />市场价</span>
      <span class="price-legend-item"><i class="price-swatch deal" />成交价</span>
      <span class="muted">单位：{{ unit }}</span>
    </div>
    <svg
      v-if="visible.length"
      class="bar-chart"
      :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      :aria-label="`建材价格对比，单位 ${unit}`"
    >
      <line :x1="PADDING.left" :x2="WIDTH - PADDING.right" :y1="baseline" :y2="baseline" stroke="#dfe6e8" stroke-width="1" />
      <g v-for="group in groups" :key="group.label">
        <rect
          v-if="group.marketPrice !== null"
          :x="group.marketX"
          :y="group.marketY"
          :width="Math.max(5, Math.min(20, group.dealX - group.marketX - 2))"
          :height="group.marketHeight"
          fill="#9fd3d0"
          rx="2"
        >
          <title>{{ group.label }} 市场价：{{ formatPrice(group.marketPrice) }} {{ unit }}</title>
        </rect>
        <rect
          :x="group.dealX"
          :y="group.dealY"
          :width="Math.max(5, Math.min(20, group.dealX - group.marketX - 2))"
          :height="group.dealHeight"
          fill="#0e7772"
          rx="2"
        >
          <title>{{ group.label }} 成交价：{{ formatPrice(group.dealPrice) }} {{ unit }}</title>
        </rect>
        <text class="bar-label" :x="group.centerX" :y="group.labelY" text-anchor="middle">
          {{ group.label.length > 6 ? `${group.label.slice(0, 6)}…` : group.label }}
        </text>
      </g>
    </svg>
    <p v-else class="muted empty-chart">{{ emptyText }}</p>
  </div>
</template>
