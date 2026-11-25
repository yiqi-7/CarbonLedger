<script setup>
defineProps({
  activePage: { type: String, default: '项目信息' },
  navigation: { type: Array, default: () => [] },
  navigationLocked: { type: Boolean, default: false },
  collapsed: { type: Boolean, default: false }
})

const emit = defineEmits(['navigate', 'toggle'])

const icons = ['⌂', '⊕', '▧', '⇄', '⚒', '♻', '◷', '▥']
</script>

<template>
  <aside class="sidebar" :class="{ 'sidebar-collapsed': collapsed }">
    <a
      class="brand"
      :class="{ 'navigation-locked': navigationLocked }"
      href="#"
      aria-label="碳建智算平台首页"
      :aria-disabled="navigationLocked ? 'true' : undefined"
      @click.prevent="!navigationLocked && emit('navigate', '首页')"
    >
      <span class="brand-mark">↗</span>
      <span class="brand-copy"><strong>碳建智算平台</strong><small>CarbonBuild</small></span>
    </a>

    <nav class="sidebar-nav" aria-label="主导航">
      <button
        v-for="(item, index) in navigation"
        :key="item"
        class="nav-item"
        :class="{ active: activePage === item }"
        :aria-label="item"
        :aria-current="activePage === item ? 'page' : undefined"
        :disabled="navigationLocked"
        @click="emit('navigate', item)"
      >
        <span class="nav-icon" aria-hidden="true">{{ icons[index] }}</span>
        <span>{{ item }}</span>
      </button>
    </nav>

    <button
      class="sidebar-toggle"
      type="button"
      :aria-label="collapsed ? '展开导航栏' : '隐藏导航栏'"
      @click="emit('toggle')"
    >
      <span class="sidebar-toggle-icon" aria-hidden="true">{{ collapsed ? '›' : '‹' }}</span>
    </button>
  </aside>
</template>
