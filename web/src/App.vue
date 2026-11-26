<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { OfficeBuilding } from '@element-plus/icons-vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
function onUnauthorized() {
  if (route.meta.customerWorkspace) return
  auth.logout()
  router.push('/login')
}

async function signOut() {
  auth.logout()
  await router.replace('/login')
}
onMounted(() => window.addEventListener('carbon-ledger-unauthorized', onUnauthorized))
onUnmounted(() => window.removeEventListener('carbon-ledger-unauthorized', onUnauthorized))
</script>

<template>
  <div class="app-shell">
    <header v-if="auth.isAuthenticated && !route.meta.customerWorkspace" class="topbar">
      <RouterLink to="/projects" class="brand"><span class="brand-mark"><OfficeBuilding aria-hidden="true" style="width: 22px; height: 22px" /></span><span>碳建智算平台</span></RouterLink>
      <div class="topbar-actions"><RouterLink v-if="auth.user?.role === 'ADMIN'" to="/admin" class="topbar-link">管理</RouterLink><span class="user-chip">{{ auth.user?.username }}</span><button class="text-button" type="button" @click="signOut">退出</button></div>
    </header>
    <main :class="{ 'page-main': auth.isAuthenticated && !route.meta.customerWorkspace }"><RouterView /></main>
  </div>
</template>
