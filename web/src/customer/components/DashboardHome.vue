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

const emit = defineEmits(['edit-project'])
const hasModelImage = computed(() => typeof props.projectInfo.modelImage === 'string' && !!props.projectInfo.modelImage)
const stats = computed(() => [
  { label: '净碳排放', value: props.netEmission },
  { label: '建材生产碳排放', value: props.buildEmission },
  { label: '运输碳排放', value: props.transportEmission },
  { label: '施工碳排放', value: props.constructionEmission },
  { label: '回收减碳量', value: props.recyclingEmission }
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
  { label: '建材生产', value: props.buildEmission, color: '#2463a6' },
  { label: '运输', value: props.transportEmission, color: '#5b83ad' },
  { label: '施工', value: props.constructionEmission, color: '#8395a8' },
  { label: '回收', value: -props.recyclingEmission, color: '#3e8069' }
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
const dashboardColors = ['#2463a6', '#3e8069', '#7c91a7', '#6e9ab8', '#8aafa1', '#b2bdc9']

function createPieGradient(items, valueFor) {
  const total = items.reduce((sum, item) => sum + Math.max(0, valueFor(item)), 0)
  if (total <= 0) return 'conic-gradient(#e8edf2 0deg 360deg)'
  let angle = 0
  const segments = items.map((item, index) => {
    const start = angle
    angle += Math.max(0, valueFor(item)) / total * 360
    return `${dashboardColors[index % dashboardColors.length]} ${start}deg ${angle}deg`
  })
  return `conic-gradient(${segments.join(', ')})`
}

function transportLabelLayout(index, count, right = 310) {
  const center = chartX(index, count, 55, right)
  const leftBound = index === 0
    ? 36
    : (chartX(index - 1, count, 55, right) + center) / 2
  const rightBound = index === count - 1
    ? right + 19
    : (center + chartX(index + 1, count, 55, right)) / 2
  if (count > 1 && index === 0) return { x: leftBound + 4, anchor: 'start', width: rightBound - leftBound - 8 }
  if (count > 1 && index === count - 1) return { x: rightBound - 4, anchor: 'end', width: rightBound - leftBound - 8 }
  return { x: center, anchor: 'middle', width: rightBound - leftBound - 8 }
}

function wrapTransportLabel(label, index, count, right = 310) {
  const maxWidth = transportLabelLayout(index, count, right).width
  const characterWidth = character => /[^\u0000-\u00ff]/.test(character) ? 10 : 6
  const lines = []
  let line = ''
  let lineWidth = 0

  for (const character of label) {
    const width = characterWidth(character)
    if (line && lineWidth + width > maxWidth) {
      lines.push(line)
      line = ''
      lineWidth = 0
    }
    line += character
    lineWidth += width
  }
  if (line) lines.push(line)
  if (lines.length <= 2) return lines
  let lastLine = lines[1]
  while ([...lastLine].reduce((width, character) => width + characterWidth(character), 0) + 10 > maxWidth) {
    lastLine = lastLine.slice(0, -1)
  }
  return [lines[0], `${lastLine}…`]
}

function transportPriceLabelY(value, index) {
  const priceY = transportPriceScale.value.y(value)
  const emission = transportVisibleItems.value[index]?.emission
  if (emission !== undefined && Math.abs(priceY - transportScale.value.y(emission)) < 18) {
    return priceY <= 120 ? priceY + 16 : priceY - 23
  }
  return priceY - 6
}

function formatPrice(value) {
  return format(value, 2)
}

function format(value, digits = 2) {
  return formatDisplayNumber(value, digits)
}
</script>

<template>
  <div class="dashboard-home dashboard-workbench">
    <header class="dashboard-heading">
      <div><h1>项目概览</h1><p>{{ projectInfo.projectName || '未命名项目' }}</p></div>
      <button class="dashboard-project-link" type="button" @click="emit('edit-project')">查看项目信息</button>
    </header>

    <section class="dashboard-top" aria-label="项目碳排放汇总">
      <article v-for="stat in stats" :key="stat.label" class="dashboard-stat">
        <span>{{ stat.label }}</span>
        <strong>{{ format(stat.value) }}<small>tCO₂e</small></strong>
      </article>
    </section>

    <section class="dashboard-overview-row" :class="{ 'has-model-image': hasModelImage }" aria-label="阶段总览">
      <article class="dashboard-panel dashboard-lifecycle">
        <header class="dashboard-panel-title"><h2>阶段碳排放</h2><span>回收减碳以负值计入 · tCO₂e</span></header>
        <div class="dashboard-lifecycle-chart">

          <svg viewBox="0 0 440 190" role="img" aria-label="建造阶段碳排放与回收减碳柱状图">
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
      <figure v-if="hasModelImage" class="dashboard-model">
        <img :src="projectInfo.modelImage" :alt="`${projectInfo.projectName}项目图片`" />
        <figcaption>项目模型<button class="dashboard-project-link" type="button" @click="emit('edit-project')">查看</button></figcaption>
      </figure>
    </section>
    <button v-if="!hasModelImage" class="dashboard-image-link" type="button" @click="emit('edit-project')">可在项目信息中添加项目模型图片</button>

    <section class="dashboard-detail-grid" aria-label="分阶段明细">
      <article class="dashboard-panel dashboard-build">
        <header class="dashboard-panel-title"><h2>建材生产</h2></header>
        <div class="dashboard-build-charts">
          <section class="dashboard-mini-chart">
            <header><i class="dashboard-legend-emission"></i>碳排放量（tCO₂e）</header>
            <svg viewBox="0 0 360 170" role="img" aria-label="建材碳排放柱状图">
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
            <svg viewBox="0 0 360 170" role="img" aria-label="建材市场价与成交价折线图">
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

      <article class="dashboard-panel dashboard-construction">
        <header class="dashboard-panel-title"><h2>施工</h2></header>
        <div class="dashboard-construction-charts">
          <section class="dashboard-mini-chart">
            <header><i class="dashboard-legend-emission"></i>碳排放量（tCO₂e）</header>
            <svg viewBox="0 0 360 170" role="img" aria-label="施工机械碳排放柱状图">
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

      <article class="dashboard-panel dashboard-transport">
        <header class="dashboard-panel-title"><h2>运输</h2></header>
        <div class="dashboard-transport-charts">
          <section class="dashboard-mini-chart">
            <header><i class="dashboard-legend-emission"></i>碳排放量（左轴 tCO₂e） <i class="dashboard-legend-deal"></i>运输总价（右轴 万元）</header>
            <svg viewBox="0 0 360 190" role="img" aria-label="运输碳排放柱状图与运输总价折线图">
              <g v-for="(tick, index) in transportScale.ticks" :key="tick.value" class="dashboard-grid-tick">
                <line x1="36" x2="329" :y1="tick.y" :y2="tick.y" />
                <text x="29" :y="tick.y + 3">{{ format(tick.value, 3) }}</text>
                <text x="357" :y="tick.y + 3">{{ format(transportPriceScale.ticks[index].value, 4) }}</text>
              </g>
              <g v-for="(item, index) in transportVisibleItems" :key="`bar-${item.label}`">
                <title>{{ item.label }}</title>
                <rect class="dashboard-transport-bar" :x="chartX(index, transportVisibleItems.length, 55, 310) - 18" :y="transportScale.y(item.emission)" width="36" :height="142 - transportScale.y(item.emission)" />
                <text class="dashboard-value-label" :x="chartX(index, transportVisibleItems.length, 55, 310)" :y="transportScale.y(item.emission) - 5">{{ format(item.emission, 1) }}</text>
                <text class="dashboard-category-label" :x="transportLabelLayout(index, transportVisibleItems.length).x" :style="{ textAnchor: transportLabelLayout(index, transportVisibleItems.length).anchor }" y="160">
                  <tspan v-for="(line, lineIndex) in wrapTransportLabel(item.label, index, transportVisibleItems.length)" :key="lineIndex" :x="transportLabelLayout(index, transportVisibleItems.length).x" :dy="lineIndex === 0 ? 0 : 14">{{ line }}</tspan>
                </text>
              </g>
              <template v-if="transportPriceItems.length">
                <polyline class="dashboard-deal-line" :points="linePoints(transportPriceItems.map(item => ({ label: item.label, dealPrice: item.value })), 'dealPrice', transportPriceScale, 55, 310)" />
                <g v-for="(item, index) in transportPriceItems" :key="`line-${item.label}`">
                  <circle class="dashboard-deal-point" :cx="chartX(index, transportPriceItems.length, 55, 310)" :cy="transportPriceScale.y(item.value)" r="3" />
                  <text class="dashboard-deal-label dashboard-transport-price-label" :x="chartX(index, transportPriceItems.length, 55, 310)" :y="transportPriceLabelY(item.value, index)">{{ formatPrice(item.value) }}</text>
                </g>
              </template>
              <text v-if="transportItems.length === 0" class="dashboard-empty-label" x="180" y="90">暂无运输数据</text>
            </svg>
          </section>
        </div>
      </article>

      <article class="dashboard-panel dashboard-recycling">
        <header class="dashboard-panel-title"><h2>回收减碳</h2></header>
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

<style scoped>
.dashboard-workbench {
  width: 100%;
  max-width: 1360px;
  min-height: 0;
  margin: 0 auto;
  padding: 32px 32px 48px;
  overflow: visible;
  color: var(--text);
  background: transparent;
}
.dashboard-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; margin-bottom: 24px; }
.dashboard-heading h1 { margin: 0; color: var(--text); font-size: 28px; line-height: 1.4; font-weight: 600; }
.dashboard-heading p { margin: 7px 0 0; color: var(--muted); font-size: 15px; line-height: 1.7; overflow-wrap: anywhere; }
.dashboard-project-link, .dashboard-image-link { border: 0; padding: 4px 0; color: var(--blue); background: transparent; font: inherit; font-size: 14px; cursor: pointer; text-align: left; }
.dashboard-project-link:hover, .dashboard-image-link:hover { text-decoration: underline; }
.dashboard-project-link:focus-visible, .dashboard-image-link:focus-visible { outline: 2px solid var(--blue); outline-offset: 4px; }
.dashboard-heading > .dashboard-project-link { flex-shrink: 0; margin-top: 6px; }
.dashboard-workbench .dashboard-top { width: 100%; max-width: none; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 0; margin: 0 0 28px; padding: 24px 0; border: 1px solid var(--line); border-radius: 12px; background: #fff; }
.dashboard-workbench .dashboard-stat { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; padding: 0 20px; border: 0; border-radius: 0; background: transparent; box-shadow: none; text-align: left; }
.dashboard-workbench .dashboard-stat + .dashboard-stat { border-left: 1px solid var(--line); }
.dashboard-workbench .dashboard-stat > span { color: var(--muted); font-size: 14px; line-height: 1.5; white-space: normal; text-wrap: balance; }
.dashboard-workbench .dashboard-stat > strong { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 6px; max-width: 100%; color: var(--text); font-size: 30px; line-height: 1.3; font-weight: 600; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.dashboard-workbench .dashboard-stat:first-child > strong { color: var(--blue); font-size: 32px; }
.dashboard-workbench .dashboard-stat:last-child > strong { color: var(--green); }
.dashboard-workbench .dashboard-stat small { color: var(--muted); font-size: 13px; font-weight: 400; white-space: nowrap; }
.dashboard-overview-row { display: grid; grid-template-columns: minmax(0, 1fr); gap: 20px; }
.dashboard-overview-row.has-model-image { grid-template-columns: minmax(0, 1fr) 260px; }
.dashboard-workbench .dashboard-panel { min-width: 0; min-height: 0; margin: 0; grid-column: auto; grid-row: auto; border: 1px solid var(--line); border-radius: 12px; background: #fff; box-shadow: none; overflow: hidden; }
.dashboard-workbench .dashboard-panel-title { min-height: 53px; height: auto; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 20px; border-bottom: 1px solid var(--line); background: transparent; }
.dashboard-panel-title h2 { margin: 0; color: var(--text); font-size: 18px; line-height: 1.4; font-weight: 600; }
.dashboard-panel-title > span { color: var(--muted); font-size: 13px; line-height: 1.6; }
.dashboard-workbench .dashboard-lifecycle-chart { height: auto; display: flex; padding: 8px 20px 14px; }
.dashboard-workbench .dashboard-lifecycle-chart svg { flex: none; width: 100%; height: 240px; }
.dashboard-model { min-width: 0; margin: 0; display: flex; flex-direction: column; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: #fff; }
.dashboard-model img { width: 100%; height: 252px; padding: 12px; object-fit: contain; background: var(--canvas); }
.dashboard-model figcaption { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; color: var(--muted); font-size: 13px; }
.dashboard-image-link { margin: 12px 0 0; color: var(--muted); font-size: 13px; }
.dashboard-detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; margin-top: 28px; }
.dashboard-workbench .dashboard-construction-charts, .dashboard-workbench .dashboard-build-charts { display: grid; grid-template-columns: minmax(0, 1fr); grid-template-rows: auto auto; height: auto; }
.dashboard-workbench .dashboard-transport-charts { display: block; height: auto; }
.dashboard-workbench .dashboard-mini-chart { min-height: 0; height: auto; padding: 20px; background: transparent; overflow-x: auto; }
.dashboard-workbench .dashboard-mini-chart + .dashboard-mini-chart { border-top: 1px solid var(--line); }
.dashboard-workbench .dashboard-mini-chart > header { height: auto; min-height: 20px; justify-content: flex-start; gap: 6px; color: var(--muted); font-size: 13px; line-height: 1.6; flex-wrap: wrap; white-space: normal; }
.dashboard-workbench .dashboard-mini-chart > svg { width: 100%; min-width: 360px; height: 220px; margin-top: 8px; }
.dashboard-workbench svg .dashboard-grid-tick text,
.dashboard-workbench svg .dashboard-value-label,
.dashboard-workbench svg .dashboard-category-label,
.dashboard-workbench svg .dashboard-market-label,
.dashboard-workbench svg .dashboard-deal-label { font-size: 10px; }
.dashboard-workbench svg .dashboard-empty-label { font-size: 12px; }
.dashboard-workbench .dashboard-transport svg .dashboard-category-label { font-size: 10px; }
.dashboard-workbench .dashboard-pie-row { height: 214px; justify-content: flex-start; gap: 24px; padding: 12px 8px; }
.dashboard-workbench .dashboard-pie, .dashboard-workbench .dashboard-donut { width: 150px; height: 150px; max-width: none; flex-shrink: 0; aspect-ratio: 1; }
.dashboard-workbench .dashboard-pie > div, .dashboard-workbench .dashboard-donut > div { gap: 4px; background: #fff; }
.dashboard-workbench .dashboard-pie strong, .dashboard-workbench .dashboard-donut strong { color: var(--text); font-size: 24px; line-height: 1.3; font-weight: 600; font-variant-numeric: tabular-nums; }
.dashboard-workbench .dashboard-donut strong { color: var(--green); }
.dashboard-workbench .dashboard-pie small, .dashboard-workbench .dashboard-donut small { color: var(--muted); font-size: 13px; }
.dashboard-workbench .dashboard-pie-legend, .dashboard-workbench .dashboard-recycling-legend { min-width: 0; flex: 1; gap: 9px; }
.dashboard-workbench .dashboard-pie-legend > span, .dashboard-workbench .dashboard-recycling-legend > span { color: var(--muted); font-size: 14px; line-height: 1.6; grid-template-columns: 8px minmax(0, 1fr) auto; gap: 8px; overflow-wrap: anywhere; }
.dashboard-workbench .dashboard-pie-legend b, .dashboard-workbench .dashboard-recycling-legend b { color: var(--text); font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; }
.dashboard-workbench .dashboard-pie-legend > small, .dashboard-workbench .dashboard-recycling-legend > small { color: var(--muted); font-size: 13px; line-height: 1.6; }
.dashboard-workbench .dashboard-recycling-content { min-height: 266px; height: auto; justify-content: flex-start; gap: 24px; padding: 24px; }
@media (max-width: 1000px) {
  .dashboard-workbench { padding: 28px 24px 40px; }
  .dashboard-workbench .dashboard-stat { padding-inline: 14px; }
  .dashboard-workbench .dashboard-stat > strong { font-size: 26px; }
  .dashboard-detail-grid { grid-template-columns: minmax(0, 1fr); }
  .dashboard-overview-row.has-model-image { grid-template-columns: minmax(0, 1fr) 220px; }
  .dashboard-workbench .dashboard-pie-row, .dashboard-workbench .dashboard-recycling-content { gap: 16px; padding-inline: 12px; }
  .dashboard-workbench .dashboard-pie, .dashboard-workbench .dashboard-donut { width: 120px; height: 120px; }
}
@media (max-width: 760px) {
  .dashboard-workbench { padding: 24px 18px 36px; }
  .dashboard-heading h1 { font-size: 24px; }
  .dashboard-workbench .dashboard-top { grid-template-columns: repeat(2, minmax(0, 1fr)); row-gap: 20px; padding: 18px 0; }
  .dashboard-workbench .dashboard-stat:first-child { grid-column: 1 / -1; padding-bottom: 18px; border-bottom: 1px solid var(--line); }
  .dashboard-workbench .dashboard-stat:nth-child(even) { border-left: 0; }
  .dashboard-workbench .dashboard-stat:last-child { grid-column: auto; }
  .dashboard-overview-row.has-model-image, .dashboard-detail-grid { grid-template-columns: minmax(0, 1fr); }
  .dashboard-model { display: grid; grid-template-columns: 140px minmax(0, 1fr); align-items: center; }
  .dashboard-model img { height: 100px; }
  .dashboard-model figcaption { gap: 12px; }
  .dashboard-workbench .dashboard-panel-title { flex-wrap: wrap; padding: 14px 16px; }
  .dashboard-workbench .dashboard-lifecycle-chart { padding-inline: 8px; }
  .dashboard-workbench .dashboard-lifecycle-chart { overflow-x: auto; }
  .dashboard-workbench .dashboard-lifecycle-chart svg { min-width: 400px; height: 190px; }
  .dashboard-workbench .dashboard-mini-chart { padding: 14px 12px; overflow-x: auto; }
  .dashboard-workbench .dashboard-mini-chart > svg { min-width: 360px; height: 190px; }
  .dashboard-workbench svg .dashboard-grid-tick text,
  .dashboard-workbench svg .dashboard-value-label,
  .dashboard-workbench svg .dashboard-category-label,
  .dashboard-workbench svg .dashboard-market-label,
  .dashboard-workbench svg .dashboard-deal-label { font-size: 11px; }
  .dashboard-workbench svg .dashboard-empty-label { font-size: 12px; }
  .dashboard-workbench .dashboard-pie, .dashboard-workbench .dashboard-donut { width: 140px; height: 140px; }
}
@media (max-width: 400px) {
  .dashboard-workbench { padding-inline: 12px; }
  .dashboard-heading { flex-direction: column; align-items: flex-start; gap: 8px; }
  .dashboard-heading > .dashboard-project-link { max-width: none; margin-top: 0; white-space: nowrap; }
  .dashboard-workbench .dashboard-pie, .dashboard-workbench .dashboard-donut { width: 110px; height: 110px; }
  .dashboard-workbench .dashboard-pie-row, .dashboard-workbench .dashboard-recycling-content { gap: 12px; flex-wrap: wrap; height: auto; justify-content: center; }
  .dashboard-workbench .dashboard-pie-legend, .dashboard-workbench .dashboard-recycling-legend { flex-basis: 100%; }
}
</style>
