import { readFileSync } from 'node:fs'
import { computed, effectScope, reactive, ref, watch } from 'vue'
import { transpileModule, ScriptTarget } from 'typescript'
import { afterEach, describe, expect, it, vi } from 'vitest'

function runSetup(file: string, context: Record<string, unknown>, exposed: string) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8')
    .split('<script setup lang="ts">')[1].split('</script>')[0]
    .replace(/^import[\s\S]*?from ['"][^'"]+['"]\r?\n/gm, '')
  const { outputText } = transpileModule(source, { compilerOptions: { target: ScriptTarget.ES2022 } })
  return new Function(...Object.keys(context), `${outputText}\nreturn { ${exposed} }`)(...Object.values(context))
}

type ProjectApi = {
  getProject: ReturnType<typeof vi.fn>
  listVersions: ReturnType<typeof vi.fn>
  getFactorConfigurations: ReturnType<typeof vi.fn>
  createFactor: ReturnType<typeof vi.fn>
  updateFactor: ReturnType<typeof vi.fn>
  saveVersion: ReturnType<typeof vi.fn>
  getVersion: ReturnType<typeof vi.fn>
  renameVersion: ReturnType<typeof vi.fn>
  deleteVersion: ReturnType<typeof vi.fn>
  exportVersionReport: ReturnType<typeof vi.fn>
}

const cleanup: Array<() => void> = []

function controls() {
  const route = reactive({ params: { id: '42' }, query: { tab: 'factors' } })
  const router = { push: vi.fn(), replace: vi.fn().mockResolvedValue(undefined) }
  const project = { id: 42, projectName: '示例项目', buildingArea: 1200, buildingType: '办公楼', accountingStandard: '标准 A' }
  const versions = [
    { id: 7, versionNumber: 1, name: '初始版本', createdAt: '2025-01-01T00:00:00.000Z' },
  ]
  const buildFactors = [{ id: 11, category: '主体', name: '水泥', emissionFactor: 1.2, materialUnit: 't', recyclingFactor: 0, recyclingCoefficient: 0 }]
  const transportFactors = [{ id: 12, vehicleName: '货车', energyType: '柴油', emissionFactor: 0.3 }]
  const api: ProjectApi = {
    getProject: vi.fn().mockResolvedValue({ data: project }),
    listVersions: vi.fn().mockResolvedValue({ data: versions.slice() }),
    getFactorConfigurations: vi.fn().mockResolvedValue([{ data: buildFactors.slice() }, { data: transportFactors.slice() }]),
    createFactor: vi.fn().mockResolvedValue({ data: { id: 13, category: '其他', name: '新增因子', emissionFactor: 0.5 } }),
    updateFactor: vi.fn().mockResolvedValue({ data: { id: 11, category: '主体', name: '更新后的水泥', emissionFactor: 2 } }),
    saveVersion: vi.fn().mockResolvedValue({ data: { id: 8, versionNumber: 2 } }),
    getVersion: vi.fn().mockResolvedValue({ data: { id: 7, versionNumber: 1, project, summary: { emission: { netEmission: 3 } } } }),
    renameVersion: vi.fn().mockResolvedValue({ data: { id: 7, name: '审阅版本' } }),
    deleteVersion: vi.fn().mockResolvedValue(undefined),
    exportVersionReport: vi.fn().mockResolvedValue(undefined),
  }
  const createProjectApi = vi.fn().mockReturnValue(api)
  const ElMessage = { success: vi.fn(), error: vi.fn(), warning: vi.fn() }
  const ElMessageBox = {
    confirm: vi.fn().mockResolvedValue(true),
    prompt: vi.fn().mockResolvedValue({ value: '审阅版本' }),
  }
  const scope = effectScope()
  const script = scope.run(() => runSetup('./ProjectToolsView.vue', {
    computed, ref, watch,
    onMounted: vi.fn(),
    useRoute: () => route,
    useRouter: () => router,
    createProjectApi,
    apiMessage: (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback,
    ElMessage,
    ElMessageBox,
    format: (value: unknown) => String(value ?? ''),
  }, 'active, project, loading, error, busyAction, unavailable, versions, buildFactors, transportFactors, factorTab, snapshotDialog, snapshotData, refresh, newFactor, saveFactor, saveVersion, viewVersion, renameVersion, deleteVersion, report, returnToProjects'))!

  cleanup.push(() => scope.stop())
  return { script, api, createProjectApi, route, router, ElMessage, ElMessageBox, project, versions }
}

async function ready() {
  const state = controls()
  await state.script.refresh()
  return state
}

afterEach(() => {
  cleanup.splice(0).forEach(dispose => dispose())
  vi.restoreAllMocks()
})

describe('ProjectToolsView controls', () => {
  it('refreshes project, versions, and both factor collections through the facade', async () => {
    const state = await ready()

    expect(state.createProjectApi).toHaveBeenCalledWith({ projectId: 42 })
    expect(state.api.getProject).toHaveBeenCalled()
    expect(state.api.listVersions).toHaveBeenCalled()
    expect(state.api.getFactorConfigurations).toHaveBeenCalled()
    expect(state.script.project.value).toEqual(state.project)
    expect(state.script.versions.value).toEqual(state.versions)
    expect(state.script.buildFactors.value).toHaveLength(1)
    expect(state.script.transportFactors.value).toHaveLength(1)
    expect(state.script.loading.value).toBe(false)
    expect(state.script.error.value).toBe('')
  }, 15000)

  it('replaces the route when the active tab changes', async () => {
    const state = await ready()

    state.script.active.value = 'versions'
    await Promise.resolve()

    expect(state.router.replace).toHaveBeenCalledWith({ query: { tab: 'versions' } })
    expect(state.script.active.value).toBe('factors')
    state.route.query.tab = 'versions'
    expect(state.script.active.value).toBe('versions')
  })

  it('creates new build and transport factors in the corresponding refs', async () => {
    const state = await ready()

    state.script.newFactor()
    expect(state.script.buildFactors.value.at(-1)).toMatchObject({ category: '其他', name: '新建因子' })
    state.script.factorTab.value = 'transport'
    state.script.newFactor()
    expect(state.script.transportFactors.value.at(-1)).toMatchObject({ vehicleName: '新建车辆', energyType: '柴油' })
  })

  it('saves an existing factor and writes the facade response back into its row', async () => {
    const state = await ready()
    const row = state.script.buildFactors.value[0]

    row.name = '待保存的水泥'
    await state.script.saveFactor('build', row)

    expect(state.api.updateFactor).toHaveBeenCalledWith('build', 11, row)
    expect(row).toMatchObject({ id: 11, name: '更新后的水泥', emissionFactor: 2 })
    expect(state.ElMessage.success).toHaveBeenCalledWith('因子配置已保存')
  })

  it('saves a version, refreshes the version ref, and reports Excel and PDF files', async () => {
    const state = await ready()
    const refreshed = [{ id: 8, versionNumber: 2, name: '新版本' }]
    state.api.listVersions.mockClear()
    state.api.listVersions.mockResolvedValueOnce({ data: refreshed })

    await state.script.saveVersion()
    expect(state.api.saveVersion).toHaveBeenCalled()
    expect(state.api.listVersions).toHaveBeenCalledOnce()
    expect(state.script.versions.value).toEqual(refreshed)

    await state.script.report(8, 'excel')
    await state.script.report(8, 'pdf')
    expect(state.api.exportVersionReport).toHaveBeenNthCalledWith(1, 8, 'excel', '示例项目-报告.xlsx')
    expect(state.api.exportVersionReport).toHaveBeenNthCalledWith(2, 8, 'pdf', '示例项目-报告.pdf')
  })

  it('loads a version snapshot into refs', async () => {
    const state = await ready()

    await state.script.viewVersion(7)

    expect(state.api.getVersion).toHaveBeenCalledWith(7)
    expect(state.script.snapshotData.value).toMatchObject({ id: 7, versionNumber: 1 })
    expect(state.script.snapshotDialog.value).toBe(true)
  })

  it('renames and deletes a version while keeping the versions ref in sync', async () => {
    const state = await ready()
    const version = state.script.versions.value[0]

    await state.script.renameVersion(version)
    expect(state.ElMessageBox.prompt).toHaveBeenCalledWith(
      '请输入新的版本名称',
      '修改版本名称',
      expect.objectContaining({ inputValue: '初始版本' }),
    )
    expect(state.api.renameVersion).toHaveBeenCalledWith(7, '审阅版本')
    expect(version.name).toBe('审阅版本')

    await state.script.deleteVersion(version)
    expect(state.ElMessageBox.confirm).toHaveBeenCalled()
    expect(state.api.deleteVersion).toHaveBeenCalledWith(7)
    expect(state.script.versions.value).toEqual([])
  })

  it('returns to the projects route', async () => {
    const state = await ready()

    state.script.returnToProjects()

    expect(state.router.push).toHaveBeenCalledWith('/projects')
  })
})
