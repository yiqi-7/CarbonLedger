import { computed, reactive } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { useCustomerRecordPersistence } from './useCustomerRecordPersistence.js'

function createList(rows) {
  return {
    rows,
    updateById: vi.fn((id, updates) => {
      const row = rows.find(item => item.id === id)
      if (row) Object.assign(row, updates)
      return row
    }),
    toArray: () => rows,
  }
}

describe('useCustomerRecordPersistence', () => {
  it('patches an existing row and clears the matching draft after persistence', async () => {
    const row = { id: 7, transportedMaterial: '砂', transportQuantity: 2 }
    const drafts = reactive({})
    const projectApi = { createRecord: vi.fn() }
    const persistence = {
      pendingCount: 0,
      resolveId: vi.fn(id => id),
      patch: vi.fn(async (_kind, id, updates) => ({ id, ...updates })),
      enqueue: vi.fn(async action => action()),
      clearDraft: vi.fn(),
      adoptCreated: vi.fn(),
      remove: vi.fn(),
    }
    const editor = useCustomerRecordPersistence({
      projectApi,
      persistence,
      canSave: () => true,
      transportVehicleConfigurations: computed(() => []),
      transportMaterialList: createList([row]),
      constructionMaterialList: createList([]),
      documentRef: { activeElement: null },
    })

    await editor.saveRow('transport-records', row, 'transportQuantity', { transportQuantity: 3 }, drafts, '3', {})

    expect(persistence.patch).toHaveBeenCalledWith('transport-records', 7, { transportQuantity: 3 })
    expect(persistence.clearDraft).toHaveBeenCalledWith(drafts, 7, 'transportQuantity', '3')
    expect(projectApi.createRecord).not.toHaveBeenCalled()
  })

  it('keeps an empty temporary row local and applies a selected transport configuration', async () => {
    const row = { id: -2, transportedMaterial: '', vehicleName: '旧车', energyType: '柴油', emissionFactor: 1, factorConfigId: 4 }
    const list = createList([row])
    const drafts = reactive({})
    const config = { id: 4, vehicleName: '新车', energyType: '电力', emissionFactor: 0.2 }
    const persistence = {
      pendingCount: 0,
      resolveId: vi.fn(id => id),
      enqueue: vi.fn(async action => action()),
      patch: vi.fn(),
      clearDraft: vi.fn(),
      adoptCreated: vi.fn(),
      remove: vi.fn(),
    }
    const editor = useCustomerRecordPersistence({
      projectApi: { createRecord: vi.fn() },
      persistence,
      canSave: () => true,
      transportVehicleConfigurations: computed(() => [config]),
      transportMaterialList: list,
      constructionMaterialList: createList([]),
      documentRef: { activeElement: null },
    })

    await editor.saveRow('transport-records', row, 'factorConfigId', { factorConfigId: 4 }, drafts, '4', {})

    expect(row).toMatchObject({ vehicleName: '新车', energyType: '电力', emissionFactor: 0.2 })
    expect(persistence.clearDraft).toHaveBeenCalledWith(drafts, -2, 'factorConfigId', '4')
    expect(persistence.enqueue).not.toHaveBeenCalled()
  })

  it('deletes through the serialized persistence queue only when saving is allowed', async () => {
    const remove = vi.fn(async () => ({ id: 3 }))
    const persistence = { enqueue: vi.fn(async action => action()), remove }
    const editor = useCustomerRecordPersistence({
      projectApi: {}, persistence, canSave: () => true,
      transportVehicleConfigurations: computed(() => []),
      transportMaterialList: createList([]), constructionMaterialList: createList([]),
      documentRef: { activeElement: null },
    })
    const drafts = {}
    await editor.deleteRow('construction-records', { id: 3 }, drafts)
    expect(remove).toHaveBeenCalledWith('construction-records', { id: 3 }, drafts)
  })
})
