import { readFileSync } from 'node:fs'
import { computed, effectScope, reactive, ref } from 'vue'
import { transpileModule, ScriptTarget } from 'typescript'
import { afterEach, describe, expect, it, vi } from 'vitest'

// Execute the real <script setup> handlers while supplying only their imported
// services and Vue lifecycle primitives. This keeps the tests independent of a
// DOM renderer and avoids replacing the control flow with a second implementation.
function runSetup(file: string, context: Record<string, unknown>, exposed: string) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8')
    .split('<script setup lang="ts">')[1].split('</script>')[0]
    .replace(/^import[\s\S]*?from ['"][^'"]+['"]\r?\n/gm, '')
  const { outputText } = transpileModule(source, { compilerOptions: { target: ScriptTarget.ES2022 } })
  return new Function(...Object.keys(context), `${outputText}\nreturn { ${exposed} }`)(...Object.values(context)) as Record<string, any>
}

const cleanups: Array<() => void> = []

afterEach(() => {
  cleanups.splice(0).forEach(cleanup => cleanup())
  vi.restoreAllMocks()
})

function elementMessages() {
  return {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  }
}

function setupLogin() {
  const router = { push: vi.fn() }
  const auth = { loading: false, login: vi.fn() }
  const messages = elementMessages()
  const scope = effectScope()
  const script = scope.run(() => runSetup('./LoginView.vue', {
    reactive, ref,
    useRouter: () => router,
    useAuthStore: () => auth,
    ElMessage: messages,
    apiMessage: (error: any, fallback: string) => error?.response?.data?.message || fallback,
  }, 'form, error, submit'))!
  cleanups.push(() => scope.stop())
  return { script, router, auth, messages }
}

function setupRegister() {
  const api = { post: vi.fn() }
  const messages = elementMessages()
  const scope = effectScope()
  const script = scope.run(() => runSetup('./RegisterView.vue', {
    reactive, ref,
    api,
    ElMessage: messages,
    apiMessage: (error: any, fallback: string) => error?.response?.data?.message || fallback,
  }, 'form, submitted, error, saving, submit'))!
  cleanups.push(() => scope.stop())
  return { script, api, messages }
}

function setupProjects() {
  const api = { get: vi.fn(), post: vi.fn(), delete: vi.fn() }
  const router = { push: vi.fn() }
  const messages = elementMessages()
  const messageBox = { confirm: vi.fn() }
  const mounted: Array<() => void> = []
  const scope = effectScope()
  const script = scope.run(() => runSetup('./ProjectsView.vue', {
    reactive, ref, computed,
    onMounted: (callback: () => void) => mounted.push(callback),
    useRouter: () => router,
    api,
    ElMessage: messages,
    ElMessageBox: messageBox,
    apiMessage: (error: any, fallback: string) => error?.response?.data?.message || fallback,
    districtsOf: (province: string) => province === '北京市' ? ['东城区', '西城区'] : province === '河北省' ? ['石家庄市'] : [],
    normalizeDistrict: (province: string, district: string) => {
      const districts = province === '北京市' ? ['东城区', '西城区'] : province === '河北省' ? ['石家庄市'] : []
      return districts.includes(district) ? district : ''
    },
    provinces: ['北京市', '河北省'],
  }, 'projects, loading, saving, dialog, pageError, removing, form, cityOptions, syncDistrict, load, openCreate, create, remove'))!
  cleanups.push(() => scope.stop())
  return { script, api, router, messages, messageBox, mounted }
}

function setupAdmin() {
  const api = { get: vi.fn(), post: vi.fn() }
  const messages = elementMessages()
  const messageBox = { confirm: vi.fn() }
  const mounted: Array<() => void> = []
  const scope = effectScope()
  const script = scope.run(() => runSetup('./AdminView.vue', {
    ref,
    onMounted: (callback: () => void) => mounted.push(callback),
    api,
    ElMessage: messages,
    ElMessageBox: messageBox,
    apiMessage: (error: any, fallback: string) => error?.response?.data?.message || fallback,
  }, 'pending, users, logs, loading, busyId, active, load, decide'))!
  cleanups.push(() => scope.stop())
  return { script, api, messages, messageBox, mounted }
}

describe('LoginView controls', () => {
  it('validates empty credentials without calling login', async () => {
    const { script, auth } = setupLogin()

    await script.submit()

    expect(script.error.value).toBe('请输入账号和密码')
    expect(auth.login).not.toHaveBeenCalled()
  })

  it('logs in successfully and navigates to projects', async () => {
    const { script, auth, router, messages } = setupLogin()
    auth.login.mockResolvedValue(undefined)
    script.form.username = '  alice  '
    script.form.password = 'secret'

    await script.submit()

    expect(auth.login).toHaveBeenCalledWith('alice', 'secret')
    expect(router.push).toHaveBeenCalledWith('/projects')
    expect(messages.success).toHaveBeenCalledWith('登录成功')
    expect(script.error.value).toBe('')
  })

  it('surfaces failed login errors', async () => {
    const { script, auth, router } = setupLogin()
    auth.login.mockRejectedValue({ response: { data: { message: '账号或密码错误' } } })
    script.form.username = 'alice'
    script.form.password = 'wrong'

    await script.submit()

    expect(script.error.value).toBe('账号或密码错误')
    expect(router.push).not.toHaveBeenCalled()
  })
})

describe('RegisterView controls', () => {
  it('rejects usernames and passwords outside their limits', async () => {
    const { script, api } = setupRegister()
    script.form.username = 'ab'
    script.form.password = '12345'

    await script.submit()

    expect(script.error.value).toBe('用户名须为 3–50 个字符，密码须为 6–100 个字符')
    expect(api.post).not.toHaveBeenCalled()
  })

  it('posts a trimmed registration and enters submitted state', async () => {
    const { script, api, messages } = setupRegister()
    api.post.mockResolvedValue({ data: {} })
    script.form.username = '  alice  '
    script.form.password = 'secret1'
    script.form.remark = '工程团队'

    await script.submit()

    expect(api.post).toHaveBeenCalledWith('/auth/register', { username: 'alice', password: 'secret1', remark: '工程团队' })
    expect(script.submitted.value).toBe(true)
    expect(script.saving.value).toBe(false)
    expect(messages.success).toHaveBeenCalledWith('申请已提交')
  })

  it('keeps the form available and reports failed registration', async () => {
    const { script, api } = setupRegister()
    api.post.mockRejectedValue({ response: { data: { message: '用户名已存在' } } })
    script.form.username = 'alice'
    script.form.password = 'secret1'

    await script.submit()

    expect(script.submitted.value).toBe(false)
    expect(script.saving.value).toBe(false)
    expect(script.error.value).toBe('用户名已存在')
  })
})

describe('ProjectsView controls', () => {
  it('validates project creation and normalizes province districts', async () => {
    const { script, api } = setupProjects()
    script.openCreate()
    expect(script.dialog.value).toBe(true)
    await script.create()
    expect(api.post).not.toHaveBeenCalled()

    script.form.projectName = '中心大厦'
    script.form.buildingArea = 120
    script.form.province = '北京市'
    script.form.cityDistrict = '东城区'
    script.syncDistrict()
    expect(script.form.cityDistrict).toBe('东城区')
    script.form.province = '河北省'
    script.syncDistrict()
    expect(script.form.cityDistrict).toBe('')
  })

  it('creates a project and reloads the list successfully', async () => {
    const { script, api, messages } = setupProjects()
    api.post.mockResolvedValue({ data: { id: 7 } })
    api.get.mockResolvedValue({ data: [{ id: 7, projectName: '中心大厦' }] })
    script.form.projectName = '  中心大厦  '
    script.form.buildingArea = 120

    await script.create()

    expect(api.post).toHaveBeenCalledWith('/projects', expect.objectContaining({ projectName: '中心大厦', buildingArea: 120 }))
    expect(api.get).toHaveBeenCalledWith('/projects')
    expect(script.projects.value).toEqual([{ id: 7, projectName: '中心大厦' }])
    expect(script.dialog.value).toBe(false)
    expect(script.saving.value).toBe(false)
    expect(messages.success).toHaveBeenCalledWith('项目已创建')
  })

  it('loads with a retry after an API error', async () => {
    const { script, api } = setupProjects()
    api.get.mockRejectedValueOnce({ response: { data: { message: '网络暂时不可用' } } })
    await script.load()
    expect(script.pageError.value).toBe('网络暂时不可用')
    expect(script.loading.value).toBe(false)

    api.get.mockResolvedValueOnce({ data: [{ id: 1, projectName: '恢复的项目' }] })
    await script.load()
    expect(script.pageError.value).toBe('')
    expect(script.projects.value).toEqual([{ id: 1, projectName: '恢复的项目' }])
  })

  it('requires confirmation before deleting and handles cancellation', async () => {
    const { script, api, messageBox } = setupProjects()
    const project = { id: 3, projectName: '待删除项目' }
    messageBox.confirm.mockRejectedValueOnce('cancel')

    await script.remove(project)

    expect(messageBox.confirm).toHaveBeenCalledWith('确定永久删除“待删除项目”？此操作不可恢复。', '删除项目', { type: 'warning' })
    expect(api.delete).not.toHaveBeenCalled()
    expect(script.removing.value).toBe(null)
  })

  it('deletes after confirmation and reloads the list', async () => {
    const { script, api, messageBox, messages } = setupProjects()
    api.get.mockResolvedValue({ data: [] })
    messageBox.confirm.mockResolvedValue(undefined)

    await script.remove({ id: 3, projectName: '待删除项目' })

    expect(api.delete).toHaveBeenCalledWith('/projects/3')
    expect(api.get).toHaveBeenCalledWith('/projects')
    expect(script.removing.value).toBe(null)
    expect(messages.success).toHaveBeenCalledWith('项目已删除')
  })
})

describe('AdminView controls', () => {
  it('loads data, changes tabs, and approves or rejects with confirmation', async () => {
    const { script, api, messageBox, messages, mounted } = setupAdmin()
    api.get.mockImplementation((path: string) => Promise.resolve({ data: path.includes('pending') ? [{ id: 9, username: 'new-user' }] : path.includes('audit') ? [{ action: 'LOGIN' }] : [{ id: 1, username: 'existing' }] }))
    await mounted[0]()

    expect(script.pending.value).toEqual([{ id: 9, username: 'new-user' }])
    expect(script.users.value).toEqual([{ id: 1, username: 'existing' }])
    expect(script.logs.value).toEqual([{ action: 'LOGIN' }])
    script.active.value = 'users'
    expect(script.active.value).toBe('users')
    script.active.value = 'audit'
    expect(script.active.value).toBe('audit')

    messageBox.confirm.mockResolvedValue(undefined)
    api.post.mockResolvedValue({ data: {} })
    await script.decide({ id: 9, username: 'new-user' }, 'approve')
    expect(messageBox.confirm).toHaveBeenCalledWith('确认批准账号“new-user”的注册申请？', '批准注册申请', { type: 'warning' })
    expect(api.post).toHaveBeenCalledWith('/admin/users/9/approve')
    expect(messages.success).toHaveBeenCalledWith('已批准账号')

    messageBox.confirm.mockResolvedValue(undefined)
    await script.decide({ id: 10, username: 'blocked-user' }, 'reject')
    expect(api.post).toHaveBeenCalledWith('/admin/users/10/reject')
    expect(messages.success).toHaveBeenCalledWith('已拒绝账号')
  })

  it('does not call the API when approval is cancelled', async () => {
    const { script, api, messageBox } = setupAdmin()
    messageBox.confirm.mockRejectedValueOnce('cancel')

    await script.decide({ id: 9, username: 'new-user' }, 'approve')

    expect(api.post).not.toHaveBeenCalled()
    expect(script.busyId.value).toBe(null)
  })
})
