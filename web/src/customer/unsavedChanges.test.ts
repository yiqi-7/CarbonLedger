import { describe, expect, it, vi } from 'vitest'
import { hasMeaningfulTemporaryRows, hasProjectDraftChanges, hasRowDraftChanges, protectUnsavedChanges } from './unsavedChanges.js'

describe('customer unsaved-change protection', () => {
  it('ignores untouched empty rows but protects work entered before a required name', () => {
    const rows = {
      build: [{ materialName: '', quantity: 1, unitPrice: 1, marketPrice: null }],
      transport: [{ id: -1, transportedMaterial: '', transportQuantity: 1, transportDistance: 1, transportUnitPrice: 1, factorConfigId: 1, initialFactorConfigId: 1 }],
      construction: [{ id: -2, machineryName: '', shiftCount: 1, energyPerShift: 1, shiftUnitPrice: 1, energyType: '电力' }],
    }
    expect(hasMeaningfulTemporaryRows(rows)).toBe(false)
    rows.build[0].quantity = 12
    expect(hasMeaningfulTemporaryRows(rows)).toBe(true)
    rows.build[0].quantity = 1
    rows.transport[0].factorConfigId = 2
    expect(hasMeaningfulTemporaryRows(rows)).toBe(true)
    rows.transport[0].factorConfigId = 1
    rows.construction[0].machineryName = '塔吊'
    expect(hasMeaningfulTemporaryRows(rows)).toBe(true)
  })

  it('detects focused input changes without treating identical values as dirty', () => {
    const rows = [{ id: 1, quantity: 2, materialName: '钢筋' }]
    expect(hasRowDraftChanges({ 1: { quantity: '2' } }, rows)).toBe(false)
    expect(hasRowDraftChanges({ 1: { quantity: '3' } }, rows)).toBe(true)
    expect(hasRowDraftChanges({ '-1': { materialName: '' } }, rows)).toBe(false)
  })

  it('protects project and image edits made after a save snapshot', () => {
    const image = { name: 'model.png' }
    const baseline = { projectName: '客户项目', modelImage: image, accountingStages: ['建造生产阶段'] }
    expect(hasProjectDraftChanges({ ...baseline, accountingStages: ['建造生产阶段'] }, baseline)).toBe(false)
    expect(hasProjectDraftChanges({ ...baseline, projectName: '更新项目' }, baseline)).toBe(true)
    expect(hasProjectDraftChanges({ ...baseline, modelImage: { name: 'new.png' } }, baseline)).toBe(true)
  })

  it('requests native unload confirmation only while work may be lost', () => {
    const event = { preventDefault: vi.fn(), returnValue: undefined }
    protectUnsavedChanges(event, false)
    expect(event.preventDefault).not.toHaveBeenCalled()
    protectUnsavedChanges(event, true)
    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(event.returnValue).toBe('')
  })
})
