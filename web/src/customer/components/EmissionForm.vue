<script setup>
import { computed, ref } from 'vue'

const emit = defineEmits(['calculate'])
const category = ref('外购电力')
const activity = ref('10000')
const unit = ref('kWh')
const factor = computed(() => category.value === '外购电力' ? 0.581 : category.value === '天然气' ? 2.165 : 0.12)

function submitForm() {
  const total = (Number(activity.value || 0) * factor.value).toFixed(2)
  emit('calculate', { total, factor: factor.value, unit: unit.value })
}
</script>

<template>
  <section class="surface-card form-card">
    <div class="card-heading"><div><p class="card-kicker">NEW ACCOUNTING</p><h2>新建排放核算</h2></div><span class="step-indicator">01 / 02</span></div>
    <p class="form-description">选择排放活动并填写对应的活动数据，系统将自动完成核算。</p>
    <form @submit.prevent="submitForm">
      <label>排放活动<select v-model="category"><option>外购电力</option><option>天然气</option><option>汽油</option></select></label>
      <div class="form-row">
        <label>活动数据<input v-model="activity" type="number" min="0" placeholder="请输入数值" /></label>
        <label>单位<select v-model="unit"><option>kWh</option><option>m³</option><option>L</option></select></label>
      </div>
      <label>排放因子<div class="factor-input"><span>{{ factor }}</span><small>kgCO₂e / {{ unit }}</small></div></label>
      <div class="form-actions"><button type="button" class="button button-ghost">取消</button><button type="submit" class="button button-primary">开始核算 <span>→</span></button></div>
    </form>
  </section>
</template>
