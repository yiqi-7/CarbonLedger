<script setup>
import { computed } from 'vue'
import { formatDisplayNumber } from '../formatDisplayNumber.js'
import { chartX, createChartScale, groupPieItems, linePoints } from '../utils/dashboardCharts.js'

const props = defineProps({
  projectInfo: { type: Object, required: true },
  buildMaterials: { type: Array, default: () => [] },
  transportMaterials: { type: Array, default: () => [] },
  constructionMaterials: { type: Array, default: () => [] },
  recyclingMaterials: { type: Array, default: () => [] },
  buildEmission: { type: Number, default: 0 },
  transportEmission: { type: Number, default: 0 },
  constructionEmission: { type: Number, default: 0 },
  recyclingEmission: { type: Number, default: 0 },
  netEmission: { type: Number, default: 0 }
})

const stats = computed(() => [
  { label: '建材生产碳排放', value: props.buildEmission, color: '#55add8' },
  { label: '运输碳排放', value: props.transportEmission, color: '#62b6d2' },
  { label: '施工碳排放', value: props.constructionEmission, color: '#f19b43' },
  { label: '回收减碳量', value: props.recyclingEmission, color: '#67bd79' },
  { label: '净碳排放', value: props.netEmission, color: '#f4b64e' }
])

function aggregate(items, labelFor, valueFor) {
  const values = new Map()
  items.forEach(item => {
    const label = labelFor(item) || '未命名'
    values.set(label, (values.get(label) ?? 0) + valueFor(item))
  })
  return [...values].map(([label, value]) => ({ label, value }))
}

const constructionItems = computed(() =>
  aggregate(props.constructionMaterials, item => item.machineryName, item => item.emissionAmount / 1000)
    .sort((left, right) => right.value - left.value)
)
const constructionPriceItems = computed(() =>
  aggregate(props.constructionMaterials, item => item.machineryName, item => item.totalPrice)
    .sort((left, right) => right.value - left.value)
)
const buildItems = computed(() =>
  aggregate(props.buildMaterials, item => item.materialName, item => item.emissionAmount)
    .sort((left, right) => right.value - left.value)
)
const buildPriceItems = computed(() =>
  [...props.buildMaterials]
    .sort((left, right) => right.emissionAmount - left.emissionAmount)
    .slice(0, 6)
    .map(item => ({
      label: item.materialName,
      marketPrice: item.marketPrice,
      dealPrice: item.unitPrice
    }))
)
const transportItems = computed(() => {
  const values = new Map()
  props.transportMaterials.forEach(item => {
    const label = item.vehicleName || '未命名'
    const current = values.get(label) ?? { label, emission: 0, totalPrice: 0 }
    current.emission += item.emissionAmount
    current.totalPrice += item.transportTotalPrice
    values.set(label, current)
  })
  return [...values.values()].sort((left, right) => right.emission - left.emission)
})
const transportPriceItems = computed(() =>
  transportItems.value.slice(0, 6).map(item => ({ label: item.label, value: item.totalPrice }))
)
const constructionVisibleItems = computed(() => constructionItems.value.slice(0, 6))
const buildVisibleItems = computed(() => buildItems.value.slice(0, 6))
const transportVisibleItems = computed(() => transportItems.value.slice(0, 6))
const constructionScale = computed(() => createChartScale(constructionVisibleItems.value.map(item => item.value), 28, 142))
const buildScale = computed(() => createChartScale(buildVisibleItems.value.map(item => item.value), 28, 142))
const buildPriceScale = computed(() => createChartScale(buildPriceItems.value.flatMap(item => [item.marketPrice, item.dealPrice]), 28, 137))
const transportScale = computed(() => createChartScale(transportVisibleItems.value.map(item => item.emission), 34, 142))
const transportPriceScale = computed(() => createChartScale(transportPriceItems.value.map(item => item.value), 34, 142))
const constructionPieItems = computed(() => groupPieItems(constructionPriceItems.value))
const constructionPieGradient = computed(() =>
  createPieGradient(constructionPieItems.value, item => item.value)
)
const constructionPriceTotal = computed(() =>
  constructionPriceItems.value.reduce((total, item) => total + item.value, 0)
)
const lifecycleItems = computed(() => [
  { label: '建材生产', value: props.buildEmission, color: '#f39821' },
  { label: '运输', value: props.transportEmission, color: '#4b8bea' },
  { label: '施工', value: props.constructionEmission, color: '#eea34b' },
  { label: '回收', value: -props.recyclingEmission, color: '#53b06e' }
])
const lifecycleScale = computed(() => createChartScale(lifecycleItems.value.map(item => item.value), 28, 155))
const recyclingCategories = computed(() =>
  aggregate(props.recyclingMaterials, item => item.materialType, item => item.reductionAmount)
    .sort((left, right) => right.value - left.value)
)
const recyclingTotal = computed(() =>
  recyclingCategories.value.reduce((total, item) => total + item.value, 0)
)
const recyclingGradient = computed(() => createPieGradient(recyclingCategories.value, item => item.value))
const dashboardColors = ['#4d8fe9', '#69c4c7', '#63b36c', '#eba943', '#a777d2', '#8196ad']

function createPieGradient(items, valueFor) {
  const total = items.reduce((sum, item) => sum + Math.max(0, valueFor(item)), 0)
  if (total <= 0) return 'conic-gradient(#243b58 0deg 360deg)'
  let angle = 0
  const segments = items.map((item, index) => {
    const start = angle
    angle += Math.max(0, valueFor(item)) / total * 360
    return `${dashboardColors[index % dashboardColors.length]} ${start}deg ${angle}deg`
  })
  return `conic-gradient(${segments.join(', ')})`
}

function wrapTransportLabel(label, index, count, right = 310) {
  const center = chartX(index, count, 55, right)
  const leftBound = index === 0
    ? 36
    : (chartX(index - 1, count, 55, right) + center) / 2
  const rightBound = index === count - 1
    ? right + 19
    : (center + chartX(index + 1, count, 55, right)) / 2
  const maxWidth = 2 * Math.min(center - leftBound, rightBound - center)
  const lines = []
  let line = ''
  let lineWidth = 0

  for (const character of label) {
    const characterWidth = /[^\u0000-\u00ff]/.test(character) ? 6 : 3.5
    if (line && lineWidth + characterWidth > maxWidth) {
      lines.push(line)
      line = ''
      lineWidth = 0
    }
    line += character
    lineWidth += characterWidth
  }
  if (line) lines.push(line)
  return lines
}

function formatPrice(value) {
  return format(value, 2)
}

function format(value, digits = 2) {
  return formatDisplayNumber(value, digits)
}
</script>

<template>
  <div class="dashboard-home">
    <header class="dashboard-title">碳建智算平台</header>

    <section class="dashboard-top">
      <article v-for="stat in stats" :key="stat.label" class="dashboard-stat">
        <span>{{ stat.label }}</span>
        <strong :style="{ color: stat.color }">
          {{ format(stat.value) }}<small> tCO₂e</small>
        </strong>
      </article>
    </section>

    <section class="dashboard-grid">
      <article class="dashboard-panel dashboard-construction">
        <header class="dashboard-panel-title"><i></i>施工碳排放</header>
        <div class="dashboard-construction-charts">
          <section class="dashboard-mini-chart">
            <header><i class="dashboard-legend-emission"></i>碳排放量（tCO₂e）</header>
            <svg viewBox="0 0 360 170" preserveAspectRatio="none" role="img" aria-label="施工机械碳排放柱状图">
              <g v-for="tick in constructionScale.ticks" :key="tick.value" class="dashboard-grid-tick">
                <line x1="36" x2="350" :y1="tick.y" :y2="tick.y" />
                <text x="29" :y="tick.y + 3">{{ format(tick.value, 3) }}</text>
              </g>
              <g v-for="(item, index) in constructionVisibleItems" :key="item.label">
                <rect class="dashboard-construction-bar" :x="chartX(index, constructionVisibleItems.length, 55, 335) - 18" :y="constructionScale.y(item.value)" width="36" :height="142 - constructionScale.y(item.value)" />
                <text class="dashboard-value-label" :x="chartX(index, constructionVisibleItems.length, 55, 335)" :y="constructionScale.y(item.value) - 5">{{ format(item.value, 1) }}</text>
                <text class="dashboard-category-label" :x="chartX(index, constructionVisibleItems.length, 55, 335)" y="158">{{ item.label }}</text>
              </g>
              <text v-if="constructionItems.length === 0" class="dashboard-empty-label" x="180" y="90">暂无施工数据</text>
            </svg>
          </section>
          <section class="dashboard-mini-chart dashboard-construction-pie">
            <header><i class="dashboard-legend-price"></i>台班总价（万元）</header>
            <div class="dashboard-pie-row">
              <div class="dashboard-pie" :style="{ backgroundImage: constructionPieGradient }">
                <div><strong>{{ format(constructionPriceTotal, 2) }}</strong><small>万元</small></div>
              </div>
              <div class="dashboard-pie-legend">
                <span v-for="(item, index) in constructionPieItems" :key="item.label">
                  <i :style="{ background: dashboardColors[index % dashboardColors.length] }"></i>{{ item.label }} <b>{{ formatPrice(item.value) }}</b>
                </span>
                <small v-if="constructionPriceItems.length === 0">暂无台班总价数据</small>
              </div>
            </div>
          </section>
        </div>
      </article>

      <article class="dashboard-panel dashboard-hero">
        <div class="dashboard-image">
          <img v-if="typeof projectInfo.modelImage === 'string' && projectInfo.modelImage" :src="projectInfo.modelImage" :alt="`${projectInfo.projectName}项目图片`" />
          <div v-else class="dashboard-image-empty"><span>⌂</span><strong>{{ projectInfo.projectName || '项目信息' }}</strong><small>请在项目信息中导入项目图片</small></div>
        </div>
        <div class="dashboard-project-name">{{ projectInfo.projectName || '项目碳排放概览' }}</div>
      </article>

      <article class="dashboard-panel dashboard-build">
        <header class="dashboard-panel-title"><i></i>建材生产碳排放</header>
        <div class="dashboard-build-charts">
          <section class="dashboard-mini-chart">
            <header><i class="dashboard-legend-emission"></i>碳排放量（tCO₂e）</header>
            <svg viewBox="0 0 360 170" preserveAspectRatio="none" role="img" aria-label="建材碳排放柱状图">
              <g v-for="tick in buildScale.ticks" :key="tick.value" class="dashboard-grid-tick">
                <line x1="36" x2="350" :y1="tick.y" :y2="tick.y" />
                <text x="29" :y="tick.y + 3">{{ format(tick.value, 3) }}</text>
              </g>
              <g v-for="(item, index) in buildVisibleItems" :key="item.label">
                <rect class="dashboard-build-bar" :x="chartX(index, buildVisibleItems.length, 55, 335) - 18" :y="buildScale.y(item.value)" width="36" :height="142 - buildScale.y(item.value)" />
                <text class="dashboard-value-label" :x="chartX(index, buildVisibleItems.length, 55, 335)" :y="buildScale.y(item.value) - 5">{{ format(item.value, 1) }}</text>
                <text class="dashboard-category-label" :x="chartX(index, buildVisibleItems.length, 55, 335)" y="158">{{ item.label }}</text>
              </g>
              <text v-if="buildItems.length === 0" class="dashboard-empty-label" x="180" y="90">暂无建材数据</text>
            </svg>
          </section>
          <section class="dashboard-mini-chart dashboard-line-chart">
            <header><i class="dashboard-legend-market"></i>市场价（元） <i class="dashboard-legend-deal"></i>成交价（元）</header>
            <svg viewBox="0 0 360 170" preserveAspectRatio="none" role="img" aria-label="建材市场价与成交价折线图">
              <g v-for="tick in buildPriceScale.ticks" :key="tick.value" class="dashboard-grid-tick">
                <line x1="36" x2="350" :y1="tick.y" :y2="tick.y" />
              </g>
              <template v-if="buildPriceItems.length">
                <polyline class="dashboard-market-line" :points="linePoints(buildPriceItems, 'marketPrice', buildPriceScale)" />
                <polyline class="dashboard-deal-line" :points="linePoints(buildPriceItems, 'dealPrice', buildPriceScale)" />
                <g v-for="(item, index) in buildPriceItems" :key="`${item.label}-${index}`">
                  <circle v-if="item.marketPrice !== null && item.marketPrice !== undefined" class="dashboard-market-point" :cx="chartX(index, buildPriceItems.length)" :cy="buildPriceScale.y(item.marketPrice)" r="3" />
                  <text v-if="item.marketPrice !== null && item.marketPrice !== undefined" class="dashboard-market-label" :x="chartX(index, buildPriceItems.length)" :y="buildPriceScale.y(item.marketPrice) - 6">{{ formatPrice(item.marketPrice) }}</text>
                  <circle class="dashboard-deal-point" :cx="chartX(index, buildPriceItems.length)" :cy="buildPriceScale.y(item.dealPrice)" r="3" />
                  <text class="dashboard-deal-label" :x="chartX(index, buildPriceItems.length)" :y="buildPriceScale.y(item.dealPrice) + 12">{{ formatPrice(item.dealPrice) }}</text>
                  <text class="dashboard-category-label" :x="chartX(index, buildPriceItems.length)" y="158">{{ item.label }}</text>
                </g>
              </template>
              <text v-else class="dashboard-empty-label" x="180" y="90">暂无建材价格数据</text>
            </svg>
          </section>
        </div>
      </article>

      <article class="dashboard-panel dashboard-transport">
        <header class="dashboard-panel-title"><i></i>运输碳排放</header>
        <div class="dashboard-transport-charts">
          <section class="dashboard-mini-chart">
            <header><i class="dashboard-legend-emission"></i>碳排放量（左轴 tCO₂e） <i class="dashboard-legend-deal"></i>运输总价（右轴 万元）</header>
            <svg viewBox="0 0 360 170" preserveAspectRatio="none" role="img" aria-label="运输碳排放柱状图与运输总价折线图">
              <g v-for="(tick, index) in transportScale.ticks" :key="tick.value" class="dashboard-grid-tick">
                <line x1="36" x2="329" :y1="tick.y" :y2="tick.y" />
                <text x="29" :y="tick.y + 3">{{ format(tick.value, 3) }}</text>
                <text x="357" :y="tick.y + 3">{{ format(transportPriceScale.ticks[index].value, 4) }}</text>
              </g>
              <g v-for="(item, index) in transportVisibleItems" :key="`bar-${item.label}`">
                <rect class="dashboard-transport-bar" :x="chartX(index, transportVisibleItems.length, 55, 310) - 18" :y="transportScale.y(item.emission)" width="36" :height="142 - transportScale.y(item.emission)" />
                <text class="dashboard-value-label" :x="chartX(index, transportVisibleItems.length, 55, 310)" :y="transportScale.y(item.emission) - 5">{{ format(item.emission, 1) }}</text>
                <text class="dashboard-category-label" :x="chartX(index, transportVisibleItems.length, 55, 310)" y="157">
                  <tspan v-for="(line, lineIndex) in wrapTransportLabel(item.label, index, transportVisibleItems.length)" :key="lineIndex" :x="chartX(index, transportVisibleItems.length, 55, 310)" :dy="lineIndex === 0 ? 0 : 7">{{ line }}</tspan>
                </text>
              </g>
              <template v-if="transportPriceItems.length">
                <polyline class="dashboard-deal-line" :points="linePoints(transportPriceItems.map(item => ({ label: item.label, dealPrice: item.value })), 'dealPrice', transportPriceScale, 55, 310)" />
                <g v-for="(item, index) in transportPriceItems" :key="`line-${item.label}`">
                  <circle class="dashboard-deal-point" :cx="chartX(index, transportPriceItems.length, 55, 310)" :cy="transportPriceScale.y(item.value)" r="3" />
                  <text class="dashboard-deal-label dashboard-transport-price-label" :x="chartX(index, transportPriceItems.length, 55, 310)" :y="transportPriceScale.y(item.value) - 6">{{ formatPrice(item.value) }}</text>
                </g>
              </template>
              <text v-if="transportItems.length === 0" class="dashboard-empty-label" x="180" y="90">暂无运输数据</text>
            </svg>
          </section>
        </div>
      </article>

      <article class="dashboard-panel dashboard-lifecycle">
        <header class="dashboard-panel-title"><i></i>项目碳排放总览</header>
        <div class="dashboard-lifecycle-chart">
          <div class="dashboard-lifecycle-total">净碳排放量 <strong>{{ format(netEmission, 1) }}</strong><small>tCO₂e</small></div>
          <svg viewBox="0 0 440 190" preserveAspectRatio="none" role="img" aria-label="建造阶段碳排放与回收减碳柱状图">
            <g v-for="tick in lifecycleScale.ticks" :key="tick.value" class="dashboard-grid-tick">
              <line x1="42" x2="430" :y1="tick.y" :y2="tick.y" />
              <text x="35" :y="tick.y + 3">{{ format(tick.value, 3) }}</text>
            </g>
            <line class="dashboard-zero-line" x1="42" x2="430" :y1="lifecycleScale.zeroY" :y2="lifecycleScale.zeroY" />
            <g v-for="(item, index) in lifecycleItems" :key="item.label">
              <rect :class="item.value < 0 ? 'dashboard-lifecycle-negative' : 'dashboard-lifecycle-bar'" :x="chartX(index, lifecycleItems.length, 95, 375) - 23" :y="lifecycleScale.bar(item.value).y" width="46" :height="lifecycleScale.bar(item.value).height" :fill="item.color" />
              <text class="dashboard-value-label" :x="chartX(index, lifecycleItems.length, 95, 375)" :y="lifecycleScale.y(item.value) + (item.value < 0 ? 10 : -5)">{{ format(item.value, 1) }}</text>
              <text class="dashboard-category-label" :x="chartX(index, lifecycleItems.length, 95, 375)" y="180">{{ item.label }}</text>
            </g>
          </svg>
        </div>
      </article>

      <article class="dashboard-panel dashboard-recycling">
        <header class="dashboard-panel-title"><i></i>回收减碳量</header>
        <div class="dashboard-recycling-content">
          <div class="dashboard-donut" :style="{ backgroundImage: recyclingGradient }">
            <div><strong>{{ format(recyclingTotal) }}</strong><small>tCO₂e</small></div>
          </div>
          <div class="dashboard-recycling-legend">
            <span v-for="(item, index) in recyclingCategories" :key="item.label">
              <i :style="{ background: dashboardColors[index % dashboardColors.length] }"></i>{{ item.label }} <b>{{ format(item.value) }}</b>
            </span>
            <small v-if="recyclingCategories.length === 0">暂无回收数据</small>
          </div>
        </div>
      </article>
    </section>
  </div>
</template>
