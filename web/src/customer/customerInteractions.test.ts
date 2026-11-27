import { readFileSync } from 'node:fs'
import { computed, markRaw, reactive, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createProjectPersistence } from './apiPersistence.js'
import { createProjectApi } from './apiProjectFacade.js'
import { createCustomerRuntime } from './composables/useCustomerRuntime.js'
import { useAnalysisViewModel } from './composables/useAnalysisViewModel.js'
import { formatDisplayNumber } from './formatDisplayNumber.js'
import { hasMeaningfulTemporaryRows, hasProjectDraftChanges, hasRowDraftChanges, protectUnsavedChanges } from './unsavedChanges.js'

const mockedApi = vi.hoisted(() => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  downloadApiFile: vi.fn(),
}))
const { api } = mockedApi
vi.mock('@/api', () => ({ ...mockedApi, apiMessage: (_error: unknown, fallback: string) => fallback }))

class List {
  head: { material: any; next: any } | null = null
  count = 0
  append(material: any) {
    const node = { material, next: null }
    if (!this.head) this.head = node
    else { let tail = this.head; while (tail.next) tail = tail.next; tail.next = node }
    this.count += 1
    return material
  }
  toArray() { const rows = []; for (let node = this.head; node; node = node.next) rows.push(node.material); return rows }
  replaceAll(rows: any[]) { this.head = null; this.count = 0; rows.forEach(row => this.append(row)) }
  updateById(id: number, fields: object) { const row = this.toArray().find(item => item.id === id); if (row) Object.assign(row, fields); return row }
  removeById(id: number) { this.replaceAll(this.toArray().filter(row => row.id !== id)) }
  findByVehicleName(name: string) { return this.toArray().find(row => row.vehicleName === name) }
}

// Exercise the customer's actual script handlers without loading a browser's
// XLSX parser or altering the retained customer template for a test harness.
function customerScript() {
  const source = readFileSync(new URL('./App.vue', import.meta.url), 'utf8').split('<script setup>')[1].split('</script>')[0]
    .replace(/^import[\s\S]*?from ['"][^'"]+['"]\r?\n/gm, '')
  const project = reactive({ projectName: '客户项目', buildingArea: 100, accountingStages: [], modelImage: null })
  const context: Record<string, any> = {
    computed, markRaw, reactive, ref, api, createProjectPersistence, createProjectApi, createCustomerRuntime, useCustomerRuntime: createCustomerRuntime, useAnalysisViewModel, formatDisplayNumber,
    hasMeaningfulTemporaryRows, hasProjectDraftChanges, hasRowDraftChanges, protectUnsavedChanges,
    apiMessage: (_error: unknown, fallback: string) => fallback,
    downloadApiFile: mockedApi.downloadApiFile,
    onMounted: vi.fn(), onBeforeUnmount: vi.fn(),
    window: { location: { search: '?projectId=42', origin: 'http://localhost' }, addEventListener: vi.fn(), removeEventListener: vi.fn(), setTimeout: vi.fn() },
    document: { activeElement: null, addEventListener: vi.fn(), removeEventListener: vi.fn() },
    HTMLInputElement: class {}, File: class {},
    URL: { createObjectURL: vi.fn().mockReturnValue('blob:model'), revokeObjectURL: vi.fn() },
    chinaCities: {}, ProjectInfo: project, saveProjectInfo: (data: object) => Object.assign(project, data),
    constructionEnergyTypes: { 电力: { unit: 'kWh', emissionFactor: 0.581 } }, transportEnergyTypes: ['柴油', '汽油'],
  }
  for (const name of ['BuildMaterialInfo', 'BuildCarbonInfo', 'BuildCarbonConfigInfo', 'BuildCarbonConfigInfoList',
    'RecyclingMateiralInfo', 'RecyclingCarbonInfo', 'ConstructionMaterialInfo', 'ConstructionCarbonInfo',
    'TransportMaterialInfo', 'TransportCarbonInfo', 'TransportCarbonConfigInfo', 'TransportCarbonConfigInfoList']) {
    context[name] = class { constructor(data: object) { Object.assign(this, data) } }
  }
  for (const name of ['buildMaterialInfoList', 'buildCarbonConfigInfoList', 'recyclingMateiralInfoList',
    'constructionMaterialInfoList', 'transportMaterialInfoList', 'transportCarbonConfigInfoList']) context[name] = new List()
  const result = new Function(...Object.keys(context), `${source}\nreturn {
    persistence, dataReady, materialList, transportMaterialList, recyclingMaterialList, constructionMaterialList, buildConfigList, transportConfigList,
    materialEditDrafts, transportEditDrafts, pendingBuildMaterials, message,
    selectBuildMaterialConfiguration, setTransportDraft, updateTransportMaterial, importRows, exportRows,
    addTransportMaterial, addConstructionMaterial, transportSearch, transportCategory,
    constructionSearch, constructionCategory, filteredTransportMaterials, filteredConstructionMaterials,
    handleFileChange, removeUploadedImage, draft, uploadedImageUrl,
    costAnalysisTotal, costAnalysisArea, recyclingQuantityGroups, analysisPieItems, analysisSelectedStage,
  }`)(...Object.values(context))
  result.dataReady.value = true
  return { ...result, context }
}

beforeEach(() => vi.resetAllMocks())

describe('customer interface save handlers', () => {
  it('saves the latest material selection when two selections happen before the first PATCH returns', async () => {
    const customer = customerScript()
    const row = customer.materialList.append({ id: 5, materialName: '旧材料' })
    const calls: number[] = []
    let finishFirst!: () => void
    let serverRow = { ...row }
    api.patch.mockImplementation(async (_path: string, body: { factorConfigId: number }) => {
      calls.push(body.factorConfigId)
      if (calls.length === 1) await new Promise<void>(resolve => { finishFirst = resolve })
      serverRow = { ...serverRow, materialName: body.factorConfigId === 1 ? '第一材料' : '第二材料' }
      return { data: { ...serverRow } }
    })
    api.get.mockImplementation(async (path: string) => ({ data: path.endsWith('/analysis') ? {} : path.endsWith('/build-materials') ? [{ ...serverRow }] : [] }))
    const first = customer.selectBuildMaterialConfiguration(row, { id: 1, name: '第一材料' })
    await Promise.resolve()
    const second = customer.selectBuildMaterialConfiguration(row, { id: 2, name: '第二材料' })
    finishFirst()
    await Promise.all([first, second])
    expect(calls).toEqual([1, 2])
    expect(customer.materialList.toArray()[0].materialName).toBe('第二材料')
    expect(customer.materialEditDrafts).toEqual({})
  })

  it('flushes a focused transport edit before replacing a temporary row after POST', async () => {
    const customer = customerScript()
    const temporary = customer.transportMaterialList.append({ id: -1, transportedMaterial: '', transportQuantity: 1,
      transportDistance: 1, transportUnitPrice: 1, factorConfigId: 2 })
    let finishCreate!: () => void
    let serverRow: any = { ...temporary, id: 90, transportedMaterial: '钢筋' }
    api.post.mockImplementation(async () => {
      await new Promise<void>(resolve => { finishCreate = resolve })
      return { data: { ...serverRow } }
    })
    api.patch.mockImplementation(async (_path: string, body: object) => { Object.assign(serverRow, body); return { data: { ...serverRow } } })
    api.get.mockImplementation(async (path: string) => ({ data: path.endsWith('/analysis') ? {} : path.endsWith('/transport-records') ? [{ ...serverRow }] : [] }))
    const create = customer.updateTransportMaterial(temporary, 'transportedMaterial', { target: { value: '钢筋' } })
    await Promise.resolve()
    const input: any = { value: '12.5', blur: vi.fn() }
    input.blur.mockImplementation(() => {
      customer.context.document.activeElement = null
      void customer.updateTransportMaterial(temporary, 'transportQuantity', { target: input })
    })
    customer.context.document.activeElement = input
    customer.setTransportDraft(-1, 'transportQuantity', { target: input })
    finishCreate()
    await create
    await customer.persistence.waitForIdle()
    expect(input.blur).toHaveBeenCalledOnce()
    expect(api.patch).toHaveBeenCalledWith('/projects/42/transport-records/90', { transportQuantity: 12.5 })
    expect(serverRow.transportQuantity).toBe(12.5)
    expect(customer.transportEditDrafts).toEqual({})
  })

  it('reports a completed import and refreshes records even if the factor refresh fails', async () => {
    const customer = customerScript()
    api.post.mockResolvedValue({ data: { imported: 2, skippedRows: 0 } })
    api.get.mockImplementation(async (path: string) => {
      if (path.endsWith('-factors')) throw new Error('offline')
      return { data: path.endsWith('/analysis') ? {} : path.endsWith('/build-materials') ? [{ id: 1 }, { id: 2 }] : [] }
    })
    const target = { files: [new Blob(['test'])], value: 'file.xlsx' }
    await customer.importRows('build-materials', { target }, '材料')
    expect(api.post).toHaveBeenCalledTimes(1)
    expect(customer.materialList.count).toBe(2)
    expect(customer.message.value).toContain('已导入 2 条材料')
    expect(customer.message.value).toContain('配置刷新失败')
    expect(target.value).toBe('')
  })

  it('uses the latest select event while an earlier vehicle choice is still saving', async () => {
    const customer = customerScript()
    customer.transportConfigList.replaceAll([
      { id: 1, vehicleName: '车一', energyType: '柴油', emissionFactor: 1 },
      { id: 2, vehicleName: '车二', energyType: '汽油', emissionFactor: 2 },
    ])
    const row = customer.transportMaterialList.append({ id: 90, vehicleName: '原车辆', energyType: '柴油', emissionFactor: 3, isCustomMaterial: true })
    let finishFirst!: () => void
    let callCount = 0
    let serverRow = { ...row }
    api.patch.mockImplementation(async (_path: string, body: { factorConfigId: number }) => {
      if (++callCount === 1) await new Promise<void>(resolve => { finishFirst = resolve })
      serverRow = { ...serverRow, ...customer.transportConfigList.toArray().find((item: any) => item.id === body.factorConfigId), id: 90 }
      return { data: { ...serverRow } }
    })
    api.get.mockImplementation(async (path: string) => ({ data: path.endsWith('/analysis') ? {} : path.endsWith('/transport-records') ? [{ ...serverRow }] : [] }))
    const first = customer.updateTransportMaterial(row, 'vehicleName', { target: { value: '车一' } })
    await Promise.resolve()
    const second = customer.updateTransportMaterial(row, 'vehicleName', { target: { value: '车二' } })
    finishFirst()
    await Promise.all([first, second])
    expect(api.patch.mock.calls.map(call => call[1])).toEqual([{ factorConfigId: 1 }, { factorConfigId: 2 }])
    expect(customer.transportMaterialList.toArray()[0].vehicleName).toBe('车二')
    expect(customer.transportEditDrafts).toEqual({})
  })

  it('reveals newly added blank rows when a search or category filter was active', () => {
    const customer = customerScript()
    customer.transportConfigList.replaceAll([{ id: 1, vehicleName: '运输车', energyType: '柴油', emissionFactor: 1 }])
    customer.transportSearch.value = '不存在的货物'
    customer.transportCategory.value = '汽油'
    customer.addTransportMaterial()
    expect(customer.filteredTransportMaterials.value).toHaveLength(1)
    customer.constructionSearch.value = '旧机械'
    customer.constructionCategory.value = '柴油'
    customer.addConstructionMaterial()
    expect(customer.filteredConstructionMaterials.value).toHaveLength(1)
  })

  it('allows selecting the same image after removing its preview and rejects unsupported image types', () => {
    const customer = customerScript()
    const file = { type: 'image/png', size: 10, name: 'model.png' }
    const target = { files: [file], value: 'model.png' }
    customer.handleFileChange({ target })
    expect(target.value).toBe('')
    expect(customer.draft.modelImage).toEqual(file)
    customer.removeUploadedImage()
    customer.handleFileChange({ target })
    expect(customer.uploadedImageUrl.value).toBe('blob:model')
    const unsupported = { files: [{ ...file, type: 'image/svg+xml' }], value: 'model.svg' }
    customer.handleFileChange({ target: unsupported })
    expect(customer.message.value).toContain('PNG、JPG 或 WebP')
    expect(customer.draft.modelImage).toEqual(file)
  })

  it('does not silently export old server values after an edit failed to save', async () => {
    const customer = customerScript()
    customer.transportMaterialList.append({ id: 1, transportedMaterial: '钢筋', transportQuantity: 1 })
    customer.transportEditDrafts[1] = { transportQuantity: '12' }
    await customer.exportRows('transport-records', '运输.xlsx', '运输记录')
    expect(customer.context.downloadApiFile).not.toHaveBeenCalled()
    expect(customer.message.value).toContain('未保存')
    delete customer.transportEditDrafts[1]
    await customer.exportRows('transport-records', '运输.xlsx', '运输记录')
    expect(customer.context.downloadApiFile).toHaveBeenCalledWith('/projects/42/exports/transport-records', '运输.xlsx')
  })

  it('keeps unsaved temporary rows out of cost and emission charts until the server accepts them', () => {
    const customer = customerScript()
    customer.transportMaterialList.append({ id: -1, transportedMaterial: '', transportTotalPrice: 2, emissionAmount: 3 })
    const pending = customer.transportMaterialList.toArray()[0]
    customer.analysisSelectedStage.value = '运输碳排放'
    expect(customer.costAnalysisTotal.value).toBe(0)
    expect(customer.analysisPieItems.value).toEqual([])
    customer.persistence.adoptCreated(customer.transportMaterialList, pending, { id: 5, transportedMaterial: '钢筋' }, customer.transportEditDrafts)
    expect(customer.costAnalysisTotal.value).toBe(2)
    expect(customer.analysisPieItems.value).toHaveLength(1)
  })

  it('shows material cost per area without adding transport or construction costs to that card', () => {
    const customer = customerScript()
    customer.context.ProjectInfo.buildingArea = 1000
    customer.materialList.append({ id: 1, totalPrice: 100 })
    customer.transportMaterialList.append({ id: 2, transportTotalPrice: 20 })
    customer.constructionMaterialList.append({ id: 3, machineryName: '塔吊', totalPrice: 30 })
    expect(customer.costAnalysisTotal.value).toBe(150)
    expect(customer.costAnalysisArea.value).toBe(0.1)
  })

  it('groups recovered quantities by equivalent units without adding unlike units or converting scales', () => {
    const customer = customerScript()
    for (const [unit, recyclingQuantity] of [['㎡', 10], ['m²', 20], ['m2', 5], ['t', 2], ['吨', 3], ['m³', 4], ['m3', 6], ['kg', 1000], ['公斤', 2]] as const) {
      customer.recyclingMaterialList.append({ unit, recyclingQuantity })
    }
    expect(customer.recyclingQuantityGroups.value).toEqual([
      { unit: 'm²', quantity: 35 }, { unit: 't', quantity: 5 },
      { unit: 'm³', quantity: 10 }, { unit: 'kg', quantity: 1002 },
    ])
  })
})
