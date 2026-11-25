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
      <h1 id="session-title">登录已过期</h1>
      <p>当前编辑内容已保留。重新登录后，请继续保存尚未提交的修改。</p>
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
  background: #061924;
}
.workspace-state {
  position: fixed;
  inset: 0;
  z-index: 10;
  display: grid;
  place-items: center;
  padding: 24px;
  color: #edf9fc;
  background: linear-gradient(145deg, #061924, #0c3441);
  text-align: center;
}
.workspace-state h1 { font-size: 22px; }
.workspace-state p { color: #b2cfd9; line-height: 1.6; }
.workspace-state-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 16px; margin-top: 24px; }
.workspace-state-actions a, .workspace-state-actions button {
  padding: 9px 16px;
  border: 1px solid #5f8797;
  border-radius: 12px;
  background: #244550;
  color: #edf9fc;
  font: inherit;
  text-decoration: none;
  cursor: pointer;
}
.workspace-state-actions a:focus-visible, .workspace-state-actions button:focus-visible { outline: 2px solid #90c4ff; outline-offset: 3px; }
.session-recovery { background: #061924eb; backdrop-filter: blur(16px); }
.session-form { width: min(100%, 460px); padding: 28px; border: 1px solid #5f8797; border-radius: 24px; background: linear-gradient(145deg, #244550, #173743); }
.session-form label { display: grid; gap: 7px; margin: 18px 0; text-align: left; }
.session-form input { width: 100%; padding: 10px 12px; border: 1px solid #5f8797; border-radius: 10px; background: #122f3b; color: #edf9fc; font: inherit; }
.session-form input:focus { outline: 2px solid #90c4ff; outline-offset: 1px; }
.session-form [role="alert"] { color: #ffb7c4; }
.session-form button:disabled { opacity: .6; cursor: wait; }
</style>
