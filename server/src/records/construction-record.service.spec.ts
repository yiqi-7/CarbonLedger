import { describe, expect, it, vi } from 'vitest'
import type { PrismaService } from '../prisma/prisma.service'
import { ConstructionRecordService } from './construction-record.service'
import type { RecordAccessService } from './record-access.service'
import type { CreateConstructionRecordDto, UpdateConstructionRecordDto } from './records.dto'

const energyDefaults = {
  电力: { emissionFactor: 0.581, unit: 'kWh' },
  柴油: { emissionFactor: 2.632, unit: 'kg' },
  汽油: { emissionFactor: 2.34, unit: 'kg' },
}

describe('ConstructionRecordService', () => {
  it('keeps owner check, default energy factor/unit, and shared formulas on create', async () => {
    const assertOwner = vi.fn().mockResolvedValue(undefined)
    const created = { id: 11 }
    const create = vi.fn().mockResolvedValue(created)
    const service = new ConstructionRecordService(
      { constructionRecord: { create } } as unknown as PrismaService,
      { assertOwner } as unknown as RecordAccessService,
    )

    const dto = {
      machineryName: '挖掘机',
      energyType: '柴油',
      shiftCount: 3,
      energyPerShift: 12,
      shiftUnitPrice: 80,
    } as CreateConstructionRecordDto

    await expect(service.createConstructionRecord(7, 9, dto)).resolves.toBe(created)
    expect(assertOwner).toHaveBeenCalledWith(7, 9)
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: 7,
        machineryName: '挖掘机',
        shiftCount: 3,
        energyType: '柴油',
        energyPerShift: 12,
        emissionFactor: energyDefaults.柴油.emissionFactor,
        energyUnit: energyDefaults.柴油.unit,
        totalEnergy: 36,
        emissionAmount: 36 * energyDefaults.柴油.emissionFactor,
        totalPrice: (3 * 80) / 10000,
        isCustomMaterial: true,
      }),
    })
  })

  it('keeps imported rows limited to shift count and unit price while recalculating shared fields', async () => {
    const assertOwner = vi.fn().mockResolvedValue(undefined)
    const existing = {
      id: 12,
      projectId: 7,
      machineryName: '导入机械',
      shiftCount: 2,
      energyType: '电力',
      energyPerShift: 5,
      emissionFactor: 0.9,
      shiftUnitPrice: 10,
      isCustomMaterial: false,
    }
    const findFirst = vi.fn().mockResolvedValue(existing)
    const updated = { id: 12 }
    const update = vi.fn().mockResolvedValue(updated)
    const service = new ConstructionRecordService(
      { constructionRecord: { findFirst, update } } as unknown as PrismaService,
      { assertOwner } as unknown as RecordAccessService,
    )
    const dto = {
      machineryName: '应被忽略',
      energyType: '柴油',
      energyPerShift: 99,
      shiftCount: 4,
      shiftUnitPrice: 25,
    } as UpdateConstructionRecordDto

    await expect(service.updateConstructionRecord(7, 9, 12, dto)).resolves.toBe(updated)
    expect(findFirst).toHaveBeenCalledWith({ where: { id: 12, projectId: 7 } })
    expect(update).toHaveBeenCalledWith({
      where: { id: 12 },
      data: expect.objectContaining({
        machineryName: '导入机械',
        energyType: '电力',
        energyPerShift: 5,
        emissionFactor: 0.9,
        shiftCount: 4,
        shiftUnitPrice: 25,
        energyUnit: energyDefaults.电力.unit,
        totalEnergy: 20,
        emissionAmount: 20 * 0.9,
        totalPrice: (4 * 25) / 10000,
      }),
    })
  })

  it('allows custom energy changes and resets factor to the energy default', async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: 13,
      projectId: 7,
      machineryName: '旧机械',
      shiftCount: 1,
      energyType: '电力',
      energyPerShift: 2,
      emissionFactor: 0.581,
      shiftUnitPrice: 10,
      isCustomMaterial: true,
    })
    const update = vi.fn().mockResolvedValue({ id: 13 })
    const service = new ConstructionRecordService(
      { constructionRecord: { findFirst, update } } as unknown as PrismaService,
      { assertOwner: vi.fn().mockResolvedValue(undefined) } as unknown as RecordAccessService,
    )

    await service.updateConstructionRecord(7, 9, 13, {
      machineryName: '新机械',
      energyType: '汽油',
      energyPerShift: 3,
      shiftCount: 2,
      shiftUnitPrice: 20,
    } as UpdateConstructionRecordDto)

    expect(update).toHaveBeenCalledWith({
      where: { id: 13 },
      data: expect.objectContaining({
        machineryName: '新机械',
        energyType: '汽油',
        energyPerShift: 3,
        emissionFactor: energyDefaults.汽油.emissionFactor,
        energyUnit: energyDefaults.汽油.unit,
        totalEnergy: 6,
      }),
    })
  })
})
