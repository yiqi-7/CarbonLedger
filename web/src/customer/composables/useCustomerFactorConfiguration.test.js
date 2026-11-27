import { ref, reactive } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { useCustomerFactorConfiguration } from './useCustomerFactorConfiguration.js'

function createSetup(overrides = {}) {
  const pending = ref([])
  const buildConfigList = { toArray: () => [{ id: 4, name: '混凝土', category: '混凝土', materialUnit: 't', emissionFactor: 1, recyclingFactor: 0, recyclingCoefficient: 0 }] }
  const materialList = { toArray: () => [], append: vi.fn() }
  const persistence = {
    pendingCount: 0, resolveId: vi.fn(id => id), enqueue: vi.fn(async action => action()),
    patch: vi.fn(), clearDraft: vi.fn(), adoptCreated: vi.fn(), remove: vi.fn(), queueDraftPatch: vi.fn(),
  }
  const setup = {
    buildConfigList, materialList, materialEditDrafts: reactive({}), pendingBuildMaterials: pending,
    pendingBuildInputDrafts: {}, activeBuildConfigMaterialId: ref(null),
    buildConfigSuggestionsPosition: reactive({ top: 0, left: 0, width: 250, maxHeight: 220 }),
    projectApi: { createRecord: vi.fn(async () => ({ data: { id: 9 } })) }, persistence,
    canSave: () => true, notify: vi.fn(), format: vi.fn(), creatingBuildMaterials: new Set(),
    documentRef: { activeElement: null }, windowRef: { innerHeight: 800, innerWidth: 1200 }, ...overrides,
  }
  return { ...setup, pending, persistence, factor: useCustomerFactorConfiguration(setup) }
}

describe('useCustomerFactorConfiguration', () => {
  it('creates and adopts a pending row after selecting a matching configuration', async () => {
    const setup = createSetup()
    const pending = { id: 'pending-build-material-1', materialName: '', quantity: 2, marketPrice: null, unitPrice: 1 }
    setup.pending.value.push(pending)
    await setup.factor.selectBuildMaterialConfiguration(pending, setup.buildConfigList.toArray()[0])

    expect(setup.projectApi.createRecord).toHaveBeenCalledWith('build-materials', { factorConfigId: 4, quantity: 2, marketPrice: null, unitPrice: 1 })
    expect(setup.persistence.adoptCreated).toHaveBeenCalled()
    expect(setup.pending.value).toEqual([])
  })

  it('rejects invalid pending prices and clears the draft', () => {
    const setup = createSetup()
    const pending = { id: 'pending-build-material-2', marketPrice: null }
    const target = { value: '-1' }
    setup.factor.updatePendingBuildMaterial(pending, 'marketPrice', { target })
    expect(target.value).toBe('')
    expect(setup.persistence.clearDraft).toHaveBeenCalledWith(setup.materialEditDrafts, pending.id, 'marketPrice', '-1')
  })

  it('cancels a pending row and clears its drafts', () => {
    const setup = createSetup()
    const pending = { id: 'pending-build-material-3' }
    setup.pending.value.push(pending)
    setup.materialEditDrafts[pending.id] = { materialName: 'x' }
    setup.factor.cancelPendingBuildMaterial(pending)
    expect(setup.pending.value).toEqual([])
    expect(setup.materialEditDrafts[pending.id]).toBeUndefined()
  })
})
