import { describe, expect, it, vi } from 'vitest'
import { useCustomerRecordFields } from './useCustomerRecordFields.js'

function createFields(overrides = {}) {
  const drafts = {
    materialEditDrafts: {},
    transportEditDrafts: {},
    constructionEditDrafts: {},
    recyclingEditDrafts: {},
  }
  const saveRow = vi.fn().mockResolvedValue(undefined)
  const persistence = { clearDraft: vi.fn() }
  const notify = vi.fn()
  const fields = useCustomerRecordFields({
    ...drafts,
    registerRowInputOwner: vi.fn(),
    saveRow,
    persistence,
    transportConfigList: { findByVehicleName: vi.fn() },
    constructionEnergyTypes: { 电力: {} },
    recyclingCategories: ['金属'],
    notify,
    formatNumber: (value, digits) => Number(value).toFixed(digits),
    getRecyclingQuantityLimit: vi.fn().mockReturnValue(null),
    ...overrides,
  })
  return { ...drafts, saveRow, persistence, notify, ...fields }
}

describe('useCustomerRecordFields', () => {
  it('rejects non-positive material quantities and clears the draft', async () => {
    const fields = createFields()
    const target = { value: '-2' }
    const material = { id: 4, quantity: 12 }

    fields.setMaterialDraft(material.id, 'quantity', { target })
    await fields.updateMaterial(material, 'quantity', { target })

    expect(target.value).toBe('12')
    expect(fields.saveRow).not.toHaveBeenCalled()
    expect(fields.persistence.clearDraft).toHaveBeenCalledWith(fields.materialEditDrafts, 4, 'quantity', '-2')
  })

  it('maps a custom transport vehicle selection to its factor configuration', async () => {
    const configuration = { id: 9, vehicleName: '车辆九', energyType: '柴油', emissionFactor: 2 }
    const findByVehicleName = vi.fn().mockReturnValue(configuration)
    const fields = createFields({ transportConfigList: { findByVehicleName } })
    const material = { id: 8, vehicleName: '车辆一', isCustomMaterial: true }
    const target = { value: '车辆九' }

    await fields.updateTransportMaterial(material, 'vehicleName', { target })

    expect(findByVehicleName).toHaveBeenCalledWith('车辆九')
    expect(fields.saveRow).toHaveBeenCalledWith(
      'transport-records', material, 'vehicleName', { factorConfigId: 9 },
      fields.transportEditDrafts, '车辆九', target,
    )
  })

  it('caps recycling quantity at the source quantity and notifies the user', async () => {
    const getRecyclingQuantityLimit = vi.fn().mockReturnValue(10)
    const fields = createFields({ getRecyclingQuantityLimit })
    const material = { id: 6, recyclingQuantity: 2, unit: 't', isCustomMaterial: true }
    const target = { value: '15' }

    fields.setRecyclingDraft(material.id, 'recyclingQuantity', { target })
    await fields.updateRecyclingMaterial(material, 'recyclingQuantity', { target })

    expect(getRecyclingQuantityLimit).toHaveBeenCalledWith(material)
    expect(fields.notify).toHaveBeenCalledWith('回收量不能超过对应建材用量 10.00 t')
    expect(target.value).toBe('10')
    expect(fields.saveRow).toHaveBeenCalledWith(
      'recycling-records', material, 'recyclingQuantity', { recyclingQuantity: 10 },
      fields.recyclingEditDrafts, '15', target,
    )
  })
})
