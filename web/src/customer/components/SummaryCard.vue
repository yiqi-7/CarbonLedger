<script setup>
defineProps({
  label: String,
  value: String,
  unit: String,
  trend: String,
  trendLabel: String,
  icon: String,
  tone: String
})
</script>

<template>
  <article class="surface-card summary-card">
    <div class="summary-top">
      <span>{{ label }}</span>
      <span class="summary-icon" :class="`tone-${tone}`">{{ icon === 'leaf' ? '♧' : icon === 'target' ? '◎' : icon === 'data' ? '▦' : '✦' }}</span>
    </div>
    <div class="summary-number">{{ value }} <small>{{ unit }}</small></div>
    <div class="summary-trend"><b :class="tone === 'green' ? 'positive' : ''">{{ trend }}</b><span>{{ trendLabel }}</span></div>
  </article>
</template>
