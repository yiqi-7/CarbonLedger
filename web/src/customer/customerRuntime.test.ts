import { describe, expect, it, vi } from 'vitest'
import { ref, reactive } from 'vue'
import { createCustomerRuntime } from './composables/useCustomerRuntime.js'

function createList(rows: any[] = []) {
  return {
    toArray: () => rows,
  }
}

function createOptions(overrides: Record<string, any> = {}) {
  const project = reactive({ projectName: '旧项目', accountingStages: [], modelImage: null })
  const windowRef: any = {
    parent: null,
    location: { origin: 'http://localhost', assign: vi.fn() },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    postMessage: vi.fn(),
    confirm: vi.fn(),
  }
  windowRef.parent = windowRef
  const documentRef: any = {
    activeElement: { blur: vi.fn() },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
  const dataReady = ref(false)
  const draft = reactive({ ...project })
  const uploadedImageUrl = ref('blob:old')
  const pendingBuildMaterials = ref<any[]>([])
  const persistence = {
    pendingCount: 0,
    waitForIdle: vi.fn().mockResolvedValue(undefined),
    refresh: vi.fn().mockResolvedValue(undefined),
    report: vi.fn(),
  }
  const projectApi = { getProject: vi.fn().mockResolvedValue({ data: { projectName: '新项目', accountingStages: [] } }) }
  const loadCarbonConfigurations = vi.fn().mockResolvedValue(undefined)
  const options = {
    projectId: 42,
    projectApi,
    persistence,
    draft,
    dataReady,
    uploadedImageUrl,
    ProjectInfo: project,
    saveProjectInfo: (data: any) => Object.assign(project, data),
    getSavedProjectDraft: () => ({ ...project }),
    setSavedProjectDraft: vi.fn(),
    pendingBuildMaterials,
    pendingBuildInputDrafts: {},
    materialList: createList(),
    transportMaterialList: createList(),
    constructionMaterialList: createList(),
    recyclingMaterialList: createList(),
    materialEditDrafts: {},
    transportEditDrafts: {},
    constructionEditDrafts: {},
    recyclingEditDrafts: {},
    notify: vi.fn(),
    loadCarbonConfigurations,
    windowRef,
    documentRef,
    inputElementClass: class Input {},
    urlRef: { revokeObjectURL: vi.fn() },
    ...overrides,
  }
  return { options, windowRef, documentRef, dataReady, draft, uploadedImageUrl, persistence, projectApi, loadCarbonConfigurations }
}

describe('customer runtime boundary', () => {
  it('loads project, factors and records concurrently and reports ready state', async () => {
    const { options, dataReady, draft, projectApi, persistence, loadCarbonConfigurations, windowRef } = createOptions()
    windowRef.parent = { postMessage: vi.fn() }
    const runtime = createCustomerRuntime(options)

    const load = runtime.loadProjectData()
    expect(projectApi.getProject).toHaveBeenCalledTimes(1)
    expect(loadCarbonConfigurations).toHaveBeenCalledTimes(1)
    expect(persistence.refresh).toHaveBeenCalledTimes(1)
    await load

    expect(dataReady.value).toBe(true)
    expect(draft.projectName).toBe('新项目')
    expect(windowRef.parent.postMessage).toHaveBeenCalledWith(
      { type: 'carbon-ledger-project-state', state: 'ready', message: '' },
      'http://localhost',
    )
  })

  it('rejects invalid project IDs without issuing API requests', async () => {
    const { options, projectApi, persistence, loadCarbonConfigurations } = createOptions({ projectId: Number.NaN })
    const runtime = createCustomerRuntime(options)

    await runtime.loadProjectData()

    expect(projectApi.getProject).not.toHaveBeenCalled()
    expect(persistence.refresh).not.toHaveBeenCalled()
    expect(loadCarbonConfigurations).not.toHaveBeenCalled()
    expect(options.notify).toHaveBeenCalledWith('请从项目列表打开项目')
  })

  it('blurs before unload, protects dirty state, and waits before leaving', async () => {
    const { options, documentRef, persistence, dataReady, draft } = createOptions()
    dataReady.value = true
    draft.projectName = '已编辑'
    const runtime = createCustomerRuntime(options)
    const event: any = { preventDefault: vi.fn(), returnValue: undefined }

    runtime.onBeforeUnload(event)
    expect(documentRef.activeElement.blur).toHaveBeenCalledTimes(1)
    expect(event.preventDefault).toHaveBeenCalledTimes(1)
    expect(event.returnValue).toBe('')

    await expect(runtime.prepareToLeave()).resolves.toBe(false)
    expect(persistence.waitForIdle).toHaveBeenCalledTimes(1)
    expect(documentRef.activeElement.blur).toHaveBeenCalledTimes(2)
  })

  it('registers and cleans session handlers, bridge messages and object URLs', () => {
    const { options, windowRef, documentRef, uploadedImageUrl } = createOptions()
    const runtime = createCustomerRuntime(options)
    runtime.mount()

    expect(windowRef.addEventListener).toHaveBeenCalledWith('beforeunload', runtime.onBeforeUnload)
    expect(documentRef.addEventListener).toHaveBeenCalledWith('input', runtime.capturePendingBuildInput, true)
    expect(windowRef.carbonLedgerCustomer).toEqual({
      hasUnsavedChanges: runtime.hasUnsavedChanges,
      prepareToLeave: runtime.prepareToLeave,
    })

    runtime.unmount()
    expect(windowRef.removeEventListener).toHaveBeenCalledWith('beforeunload', runtime.onBeforeUnload)
    expect(documentRef.removeEventListener).toHaveBeenCalledWith('input', runtime.capturePendingBuildInput, true)
    expect(options.urlRef.revokeObjectURL).toHaveBeenCalledWith(uploadedImageUrl.value)
    expect(windowRef.carbonLedgerCustomer).toBeUndefined()
  })
})
