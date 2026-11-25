<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const frame = ref<HTMLIFrameElement | null>(null)
const source = computed(() => `/customer.html?projectId=${encodeURIComponent(String(route.params.id))}`)

type CustomerWindow = Window & {
  carbonLedgerCustomer?: {
    prepareToLeave: () => Promise<boolean>
  }
}
async function prepareToLeave() {
  const customer = (frame.value?.contentWindow as CustomerWindow | null)?.carbonLedgerCustomer
  if (!customer || await customer.prepareToLeave()) return true
  return window.confirm('还有未保存的内容，确定离开此项目吗？')
}
onBeforeRouteLeave(prepareToLeave)
onBeforeRouteUpdate(prepareToLeave)

function receiveMessage(event: MessageEvent) {
  if (event.origin !== window.location.origin || event.source !== frame.value?.contentWindow) return
  if (event.data?.type === 'carbon-ledger-unauthorized') {
    auth.logout()
    router.replace('/login')
  }
}
onMounted(() => window.addEventListener('message', receiveMessage))
onUnmounted(() => window.removeEventListener('message', receiveMessage))
</script>

<template>
  <iframe ref="frame" :key="source" :src="source" class="customer-workspace" title="碳建智算项目工作区" />
</template>

<style scoped>
.customer-workspace {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
  background: #0b1018;
}
</style>
