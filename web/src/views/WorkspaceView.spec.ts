import { readFileSync } from 'node:fs'
import { computed, effectScope, markRaw, nextTick, reactive, ref, watch } from 'vue'
import { transpileModule, ScriptTarget } from 'typescript'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CUSTOMER_MESSAGE_TYPES, isCustomerMessage } from '@/customer/bridge'

// Run the real component handlers without replacing their routing or session
// decisions with a second implementation in the test.
function runSetup(file: string, context: Record<string, unknown>, exposed: string) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8')
    .split('<script setup lang="ts">')[1].split('</script>')[0]
    .replace(/^import[\s\S]*?from ['"][^'"]+['"]\r?\n/gm, '')
  const { outputText } = transpileModule(source, { compilerOptions: { target: ScriptTarget.ES2022 } })
  return new Function(...Object.keys(context), `${outputText}\nreturn { ${exposed} }`)(...Object.values(context))
}

const cleanup: Array<() => void> = []

function workspace() {
  const route = reactive({ params: { id: '42' }, meta: { customerWorkspace: true } })
  const router = { push: vi.fn(), replace: vi.fn() }
  const auth = {
    user: { username: 'project-owner' } as { username: string } | null,
    loading: false,
    isAuthenticated: true,
    logout: vi.fn(),
    login: vi.fn(),
  }
  auth.logout.mockImplementation(() => { auth.user = null; auth.isAuthenticated = false })
  auth.login.mockImplementation(async (username: string) => {
    auth.user = { username }
    auth.isAuthenticated = true
  })
  const draft = { projectName: '尚未保存的项目名称', quantity: '12.5' }
  const customer = { prepareToLeave: vi.fn().mockResolvedValue(false), draft }
  const frameWindow = markRaw({ carbonLedgerCustomer: customer })
  const confirm = vi.fn().mockReturnValue(false)
  const leaveGuards: Array<() => Promise<boolean>> = []
  const updateGuards: Array<() => Promise<boolean>> = []
  const mounted: Array<() => void> = []
  const unmounted: Array<() => void> = []
  const scope = effectScope()
  const script = scope.run(() => runSetup('./WorkspaceView.vue', {
    computed, nextTick, ref, watch, CUSTOMER_MESSAGE_TYPES, isCustomerMessage,
    onMounted: (callback: () => void) => mounted.push(callback),
    onUnmounted: (callback: () => void) => unmounted.push(callback),
    onBeforeRouteLeave: (callback: () => Promise<boolean>) => leaveGuards.push(callback),
    onBeforeRouteUpdate: (callback: () => Promise<boolean>) => updateGuards.push(callback),
    useRoute: () => route, useRouter: () => router, useAuthStore: () => auth,
    apiMessage: (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback,
    window: { location: { origin: 'http://localhost' }, confirm, addEventListener: vi.fn(), removeEventListener: vi.fn() },
    setTimeout, clearTimeout,
  }, 'frame, source, attempt, loading, loadError, sessionExpired, sessionUsername, sessionPassword, sessionError, passwordInput, receiveMessage, restoreSession, retry'))!
  script.frame.value = markRaw({ contentWindow: frameWindow })
  mounted.forEach(callback => callback())
  cleanup.push(() => { unmounted.forEach(callback => callback()); scope.stop() })
  const message = (data: object, overrides: object = {}) => script.receiveMessage({
    origin: 'http://localhost', source: frameWindow, data, ...overrides,
  })
  return { script, message, auth, router, route, frameWindow, customer, confirm, leaveGuards, updateGuards }
}

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => {
  cleanup.splice(0).forEach(dispose => dispose())
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('customer workspace session and navigation', () => {
  it('preserves the loaded iframe and its drafts on 401, and handles repeated 401s only once', async () => {
    const { script, message, auth, router, frameWindow, customer } = workspace()
    message({ type: CUSTOMER_MESSAGE_TYPES.projectState, state: 'ready' })
    const focus = vi.fn()
    script.passwordInput.value = markRaw({ focus })
    message({ type: CUSTOMER_MESSAGE_TYPES.unauthorized })
    message({ type: CUSTOMER_MESSAGE_TYPES.unauthorized })
    await nextTick()

    expect(auth.logout).toHaveBeenCalledOnce()
    expect(script.sessionExpired.value).toBe(true)
    expect(script.sessionUsername.value).toBe('project-owner')
    expect(script.frame.value.contentWindow).toBe(frameWindow)
    expect(script.attempt.value).toBe(0)
    expect(customer.draft).toEqual({ projectName: '尚未保存的项目名称', quantity: '12.5' })
    expect(router.push).not.toHaveBeenCalled()
    expect(router.replace).not.toHaveBeenCalled()
    expect(focus).toHaveBeenCalledOnce()
    vi.advanceTimersByTime(30000)
    expect(script.loadError.value).toBe('')
  })

  it('restores the original account without remounting an already loaded project', async () => {
    const { script, message, auth, frameWindow, customer } = workspace()
    message({ type: CUSTOMER_MESSAGE_TYPES.projectState, state: 'ready' })
    message({ type: CUSTOMER_MESSAGE_TYPES.unauthorized })
    script.sessionPassword.value = 'test-password'
    await script.restoreSession()

    expect(auth.login).toHaveBeenCalledWith('project-owner', 'test-password')
    expect(script.sessionExpired.value).toBe(false)
    expect(script.sessionPassword.value).toBe('')
    expect(script.attempt.value).toBe(0)
    expect(script.loading.value).toBe(false)
    expect(script.frame.value.contentWindow).toBe(frameWindow)
    expect(customer.draft.quantity).toBe('12.5')
  })

  it('retains the editing session when credentials fail, then allows another login attempt', async () => {
    const { script, message, auth, customer } = workspace()
    message({ type: CUSTOMER_MESSAGE_TYPES.projectState, state: 'ready' })
    message({ type: CUSTOMER_MESSAGE_TYPES.unauthorized })
    auth.login.mockRejectedValueOnce(new Error('账号或密码错误'))
    script.sessionPassword.value = 'incorrect-password'
    await script.restoreSession()
    expect(script.sessionExpired.value).toBe(true)
    expect(script.sessionError.value).toBe('账号或密码错误')
    expect(script.attempt.value).toBe(0)
    expect(customer.draft.projectName).toBe('尚未保存的项目名称')
    script.sessionPassword.value = 'correct-password'
    await script.restoreSession()
    expect(script.sessionExpired.value).toBe(false)
    expect(script.sessionError.value).toBe('')
  })

  it('reloads an interrupted initial load after login, while failed projects can be retried', async () => {
    const { script, message } = workspace()
    message({ type: CUSTOMER_MESSAGE_TYPES.unauthorized })
    message({ type: CUSTOMER_MESSAGE_TYPES.projectState, state: 'error', message: '请重新登录' })
    script.sessionPassword.value = 'test-password'
    await script.restoreSession()
    expect(script.attempt.value).toBe(1)
    expect(script.loading.value).toBe(true)
    expect(script.loadError.value).toBe('')

    message({ type: CUSTOMER_MESSAGE_TYPES.projectState, state: 'error', message: '项目不存在' })
    expect(script.loading.value).toBe(false)
    expect(script.loadError.value).toBe('项目不存在')
    script.retry()
    expect(script.attempt.value).toBe(2)
    expect(script.loading.value).toBe(true)
    vi.advanceTimersByTime(25000)
    expect(script.loadError.value).toContain('加载超时')
    script.retry()
    message({ type: CUSTOMER_MESSAGE_TYPES.projectState, state: 'ready' })
    vi.advanceTimersByTime(30000)
    expect(script.loading.value).toBe(false)
    expect(script.loadError.value).toBe('')
  })

  it('accepts state, session, and directory messages only from the current same-origin iframe', () => {
    const { script, message, auth, router } = workspace()
    const data = [
      { type: CUSTOMER_MESSAGE_TYPES.unauthorized },
      { type: CUSTOMER_MESSAGE_TYPES.projects },
      { type: CUSTOMER_MESSAGE_TYPES.projectState, state: 'error', message: '伪造状态' },
    ]
    for (const value of data) {
      message(value, { origin: 'https://unrelated.example' })
      message(value, { source: {} })
    }
    expect(script.sessionExpired.value).toBe(false)
    expect(script.loading.value).toBe(true)
    expect(script.loadError.value).toBe('')
    expect(auth.logout).not.toHaveBeenCalled()
    expect(router.push).not.toHaveBeenCalled()
    message({ type: CUSTOMER_MESSAGE_TYPES.projects })
    expect(router.push).toHaveBeenCalledWith('/projects')
  })

  it('waits for the customer save queue before asking to leave, and cancellation retains the project', async () => {
    const { customer, confirm, leaveGuards, updateGuards, script, frameWindow } = workspace()
    expect(leaveGuards).toHaveLength(1)
    expect(updateGuards).toHaveLength(1)
    let finishSaving!: (saved: boolean) => void
    customer.prepareToLeave.mockImplementationOnce(() => new Promise<boolean>(resolve => { finishSaving = resolve }))
    const leaving = leaveGuards[0]()
    await Promise.resolve()
    expect(confirm).not.toHaveBeenCalled()
    finishSaving(false)
    expect(await leaving).toBe(false)
    expect(confirm).toHaveBeenCalledOnce()
    expect(script.frame.value.contentWindow).toBe(frameWindow)
    expect(script.attempt.value).toBe(0)
    expect(customer.draft.projectName).toBe('尚未保存的项目名称')

    customer.prepareToLeave.mockResolvedValueOnce(true)
    expect(await updateGuards[0]()).toBe(true)
    expect(confirm).toHaveBeenCalledTimes(1)
    confirm.mockReturnValueOnce(true)
    expect(await leaveGuards[0]()).toBe(true)
  })

  it('keeps the same leave protection when returning to login after a session expires', async () => {
    const { message, auth, leaveGuards, confirm, customer } = workspace()
    message({ type: CUSTOMER_MESSAGE_TYPES.unauthorized })
    expect(auth.isAuthenticated).toBe(false)
    expect(await leaveGuards[0]()).toBe(false)
    expect(customer.prepareToLeave).toHaveBeenCalledOnce()
    expect(confirm).toHaveBeenCalledOnce()
  })

  it('lets the workspace recover a 401 without the root app navigating away', () => {
    const route = { meta: { customerWorkspace: true } }
    const router = { push: vi.fn() }
    const auth = { logout: vi.fn() }
    const script = runSetup('../App.vue', {
      onMounted: vi.fn(), onUnmounted: vi.fn(),
      useRoute: () => route, useRouter: () => router, useAuthStore: () => auth,
    }, 'onUnauthorized, signOut')
    script.onUnauthorized()
    expect(auth.logout).not.toHaveBeenCalled()
    expect(router.push).not.toHaveBeenCalled()
    route.meta.customerWorkspace = false
    script.onUnauthorized()
    expect(auth.logout).toHaveBeenCalledOnce()
    expect(router.push).toHaveBeenCalledWith('/login')
  })

  it('clears the session before replacing the current route on explicit sign out', async () => {
    const route = { meta: { customerWorkspace: false } }
    const router = { push: vi.fn(), replace: vi.fn().mockResolvedValue(undefined) }
    const auth = { logout: vi.fn() }
    const script = runSetup('../App.vue', {
      onMounted: vi.fn(), onUnmounted: vi.fn(),
      useRoute: () => route, useRouter: () => router, useAuthStore: () => auth,
    }, 'signOut')
    await script.signOut()
    expect(auth.logout).toHaveBeenCalledOnce()
    expect(router.replace).toHaveBeenCalledWith('/login')
    expect(router.push).not.toHaveBeenCalled()
  })
})
