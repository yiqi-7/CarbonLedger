<script setup>
defineProps({ activePage: { type: String, default: '工作台' } })
const emit = defineEmits(['notification'])
</script>

<template>
  <header class="top-header">
    <div class="breadcrumb"><span>碳迹</span><b>/</b><strong>{{ activePage }}</strong></div>
    <div class="header-actions">
      <button class="header-icon-button" aria-label="搜索">⌕</button>
      <button class="header-icon-button notification-button" aria-label="通知" @click="emit('notification')">
        ♧<i></i>
      </button>
      <div class="header-divider"></div>
      <div class="organization-switcher"><span class="organization-dot"></span><span>远山科技</span><b>⌄</b></div>
    </div>
  </header>
</template>
