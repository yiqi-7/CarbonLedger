<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { RouterView, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
function onUnauthorized() { auth.logout(); router.push('/login') }
onMounted(() => window.addEventListener('carbon-ledger-unauthorized', onUnauthorized))
onUnmounted(() => window.removeEventListener('carbon-ledger-unauthorized', onUnauthorized))
</script>

<template>
  <div class="app-shell">
    <header v-if="auth.isAuthenticated" class="topbar">
      <RouterLink to="/projects" class="brand"><span class="brand-mark">CL</span><span>CarbonLedger</span></RouterLink>
      <div class="topbar-actions"><span class="user-chip">{{ auth.user?.username }}</span><button class="text-button" @click="auth.logout(); router.push('/login')">退出</button></div>
    </header>
    <main :class="{ 'page-main': auth.isAuthenticated }"><RouterView /></main>
  </div>
</template>
