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
  background: var(--platform-canvas);
}
.workspace-state {
  position: fixed;
  inset: 0;
  z-index: 10;
  display: grid;
  place-items: center;
  padding: 24px;
  color: var(--platform-ink);
  background: var(--platform-canvas);
  text-align: center;
}
.workspace-state h1 { margin: 0 0 12px; font-size: 28px; font-weight: 600; letter-spacing: -0.02em; }
.workspace-state p { color: var(--platform-muted); font-size: 15px; line-height: 1.65; }
.workspace-state > div {
  width: min(100%, 480px);
  padding: 34px;
  border: 1px solid rgba(37, 65, 74, 0.14);
  border-radius: 28px;
  background: var(--surface-solid-content);
  box-shadow: var(--platform-shadow-lg);
}
.workspace-state-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 14px; margin-top: 24px; }
.workspace-state-actions a, .workspace-state-actions button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 10px 22px;
  border: 1px solid rgba(37, 65, 74, 0.16);
  border-radius: 999px;
  background: var(--surface-tinted-glass);
  color: var(--platform-ink);
  font: inherit;
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
  transition: background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease, transform 420ms cubic-bezier(0.22, 1.4, 0.36, 1);
}
.workspace-state-actions button {
  background: linear-gradient(180deg, #2C4D57 0%, #223C45 100%);
  border-color: #25414A;
  color: #FFFFFF;
  box-shadow: 0 8px 20px rgba(19, 37, 41, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.3);
}
.workspace-state-actions a:hover { background: #FCFCFA; border-color: var(--color-focus); color: var(--color-glass-scene); }
.workspace-state-actions button:hover { background: linear-gradient(180deg, #25434C 0%, #1B3138 100%); border-color: #1B3138; }
.workspace-state-actions a:focus-visible, .workspace-state-actions button:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 3px; }
.session-recovery { background: rgba(21, 37, 42, 0.44); backdrop-filter: blur(10px); }
.session-form {
  width: min(100%, 480px);
  padding: 34px;
  border: 1px solid rgba(255, 255, 255, 0.52);
  border-radius: 28px;
  background: rgba(252, 252, 250, 0.94);
  box-shadow: var(--platform-shadow-lg);
}
.session-form label { display: grid; gap: 9px; margin: 22px 0; text-align: left; }
.session-form input {
  width: 100%;
  min-height: 48px;
  padding: 10px 18px;
  border: 1px solid var(--platform-field-line);
  border-radius: 999px;
  background: var(--surface-solid-content);
  color: var(--platform-ink);
  font: inherit;
  transition: border-color 0.16s ease, box-shadow 0.16s ease;
}
.session-form input[readonly] { background: var(--platform-canvas); color: var(--platform-muted); }
.session-form input:focus { border-color: var(--color-focus); outline: none; box-shadow: 0 0 0 4px var(--platform-focus-ring); }
.session-form [role="alert"] { color: var(--el-color-danger); }
.session-form button:disabled { opacity: .6; cursor: wait; }
</style>
