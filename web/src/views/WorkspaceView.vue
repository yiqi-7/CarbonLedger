<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { apiMessage } from '@/api'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const frame = ref<HTMLIFrameElement | null>(null)
const source = computed(() => `/customer.html?projectId=${encodeURIComponent(String(route.params.id))}`)
const attempt = ref(0)
const loading = ref(true)
const loadError = ref('')
const sessionExpired = ref(false)
const sessionUsername = ref(auth.user?.username || '')
const sessionPassword = ref('')
const sessionError = ref('')
const passwordInput = ref<HTMLInputElement | null>(null)
let loadTimer: ReturnType<typeof setTimeout> | undefined

function resetLoading() {
  clearTimeout(loadTimer)
  loading.value = true
  loadError.value = ''
  loadTimer = setTimeout(() => {
    loading.value = false
    loadError.value = '项目加载超时，请检查网络后重试。'
  }, 25000)
}
function retry() { resetLoading(); attempt.value += 1 }
watch(source, resetLoading)

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

async function restoreSession() {
  if (auth.loading || !sessionPassword.value) return
  sessionError.value = ''
  try {
    await auth.login(sessionUsername.value, sessionPassword.value)
    sessionPassword.value = ''
    sessionExpired.value = false
    if (loadError.value || loading.value) retry()
  } catch (error) {
    sessionError.value = apiMessage(error, '登录失败，请重试。')
  }
}

function receiveMessage(event: MessageEvent) {
  if (event.origin !== window.location.origin || event.source !== frame.value?.contentWindow) return
  if (event.data?.type === 'carbon-ledger-unauthorized') {
    if (sessionExpired.value) return
    sessionUsername.value = auth.user?.username || sessionUsername.value
    auth.logout()
    sessionExpired.value = true
    clearTimeout(loadTimer)
    void nextTick(() => passwordInput.value?.focus())
  } else if (event.data?.type === 'carbon-ledger-projects') {
    void router.push('/projects')
  } else if (event.data?.type === 'carbon-ledger-project-state') {
    clearTimeout(loadTimer)
    loading.value = false
    loadError.value = event.data.state === 'ready' ? '' : String(event.data.message || '项目加载失败，请重试。')
  }
}
onMounted(() => { resetLoading(); window.addEventListener('message', receiveMessage) })
onUnmounted(() => { clearTimeout(loadTimer); window.removeEventListener('message', receiveMessage) })
</script>

<template>
  <iframe ref="frame" :key="`${source}:${attempt}`" :src="source" :inert="loading || !!loadError || sessionExpired" :aria-hidden="loading || !!loadError || sessionExpired" class="customer-workspace" title="碳建智算项目工作区" />
  <section v-if="sessionExpired" class="workspace-state session-recovery" role="dialog" aria-modal="true" aria-labelledby="session-title">
    <form class="session-form" @submit.prevent="restoreSession">
      <h1 id="session-title">请重新登录</h1>
      <p>登录状态已失效。页面中的编辑内容仍在，重新登录后可继续保存，请勿刷新页面。</p>
      <label>账号<input :value="sessionUsername" autocomplete="username" readonly /></label>
      <label>密码<input ref="passwordInput" v-model="sessionPassword" type="password" autocomplete="current-password" required /></label>
      <p v-if="sessionError" role="alert">{{ sessionError }}</p>
      <div class="workspace-state-actions">
        <button type="submit" :disabled="auth.loading">{{ auth.loading ? '正在登录…' : '重新登录并继续' }}</button>
        <RouterLink to="/login">返回登录页</RouterLink>
      </div>
    </form>
  </section>
  <section v-else-if="loading || loadError" class="workspace-state" :aria-busy="loading">
    <div>
      <h1>{{ loading ? '正在加载项目' : '无法打开项目' }}</h1>
      <p role="status">{{ loading ? '正在读取已保存的项目数据…' : loadError }}</p>
      <div class="workspace-state-actions">
        <button v-if="loadError" type="button" @click="retry">重新加载</button>
        <RouterLink to="/projects">返回我的项目</RouterLink>
      </div>
    </div>
  </section>
</template>

<style scoped>
.customer-workspace {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
  background: #f5f6f8;
}
.workspace-state {
  position: fixed;
  inset: 0;
  z-index: 10;
  display: grid;
  place-items: center;
  padding: 24px;
  color: #18263a;
  background: #f5f6f8;
  text-align: center;
}
.workspace-state h1 { margin: 0 0 12px; font-size: 24px; font-weight: 600; }
.workspace-state p { color: #5f6d7d; line-height: 1.7; }
.workspace-state > div { width: min(100%, 460px); padding: 32px; border: 1px solid #dce2e9; border-radius: 12px; background: #fff; }
.workspace-state-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 16px; margin-top: 24px; }
.workspace-state-actions a, .workspace-state-actions button {
  padding: 9px 16px;
  border: 1px solid #cbd3dd;
  border-radius: 8px;
  background: #fff;
  color: #2563a6;
  font: inherit;
  text-decoration: none;
  cursor: pointer;
}
.workspace-state-actions button { background: #2563a6; border-color: #2563a6; color: #fff; }
.workspace-state-actions a:hover { background: #f5f6f8; }
.workspace-state-actions button:hover { background: #1e5087; }
.workspace-state-actions a:focus-visible, .workspace-state-actions button:focus-visible { outline: 2px solid #2563a6; outline-offset: 3px; }
.session-recovery { background: #f5f6f8; }
.session-form { width: min(100%, 460px); padding: 32px; border: 1px solid #dce2e9; border-radius: 12px; background: #fff; }
.session-form label { display: grid; gap: 7px; margin: 18px 0; text-align: left; }
.session-form input { width: 100%; padding: 10px 12px; border: 1px solid #cbd3dd; border-radius: 8px; background: #fff; color: #18263a; font: inherit; }
.session-form input[readonly] { background: #f5f6f8; color: #5f6d7d; }
.session-form input:focus { outline: 2px solid #2563a6; outline-offset: 1px; }
.session-form [role="alert"] { color: #a53333; }
.session-form button:disabled { opacity: .6; cursor: wait; }
</style>
