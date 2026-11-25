<script setup>
import { ref } from 'vue'

const activeTab = ref('月度')
const tabs = ['月度', '季度', '年度']
const bars = [57, 72, 54, 82, 63, 70, 49, 66, 77, 61, 87, 73]
const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
</script>

<template>
  <article class="surface-card trend-card">
    <div class="card-heading">
      <div><p class="card-kicker">EMISSION OVERVIEW</p><h2>碳排放趋势</h2></div>
      <div class="tab-switcher">
        <button v-for="tab in tabs" :key="tab" :class="{ active: activeTab === tab }" @click="activeTab = tab">{{ tab }}</button>
      </div>
    </div>
    <div class="legend"><span class="legend-item"><i class="legend-dot actual"></i>实际排放</span><span class="legend-item"><i class="legend-dot target"></i>目标排放</span><span class="chart-unit">单位：tCO₂e</span></div>
    <div class="bar-chart">
      <div class="y-axis"><span>1,000</span><span>750</span><span>500</span><span>250</span><span>0</span></div>
      <div class="bars-area">
        <div class="grid-line line-one"></div><div class="grid-line line-two"></div><div class="grid-line line-three"></div><div class="grid-line line-four"></div>
        <div v-for="(height, index) in bars" :key="months[index]" class="bar-column">
          <div class="bar-value" :style="{ height: `${height}%` }"><span v-if="index === 9">824</span></div>
          <small>{{ months[index] }}</small>
        </div>
      </div>
    </div>
  </article>
</template>
