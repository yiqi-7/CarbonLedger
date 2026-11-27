import { describe, expect, it, vi } from 'vitest'
import type { PrismaService } from '../prisma/prisma.service'
import { RecyclingRecordService } from './recycling-record.service'
import type { RecordAccessService } from './record-access.service'
import type { CreateRecyclingRecordDto, UpdateRecyclingRecordDto } from './records.dto'

describe('RecyclingRecordService', () => {
  it('checks ownership and stores calculated fields for a custom record', async () => {
    const assertOwner = vi.fn().mockResolvedValue(undefined)
    const create = vi.fn().mockResolvedValue({ id: 11 })
    const service = new RecyclingRecordService(
      { recyclingRecord: { create } } as unknown as PrismaService,
      { assertOwner } as unknown as RecordAccessService,
    )

    const dto = {
      materialName: '废钢',
      materialType: '金属',
      recyclingQuantity: 10,
      unit: '吨',
      recyclingFactor: 2,
      recyclingCoefficient: 0.5,
      recyclingUnitPrice: 80,
    } as CreateRecyclingRecordDto

    await expect(service.createRecyclingRecord(7, 9, dto)).resolves.toEqual({ id: 11 })
    expect(assertOwner).toHaveBeenCalledWith(7, 9)
    expect(create).toHaveBeenCalledWith({
      data: {
        projectId: 7,
        materialName: '废钢',
        materialType: '金属',
        recyclingQuantity: 10,
        unit: '吨',
        recyclingFactor: 2,
        recyclingCoefficient: 0.5,
        recyclingUnitPrice: 80,
        sourceBuildMaterialId: null,
        isCustomMaterial: true,
        reductionAmount: 0.01,
        residualValue: 0.08,
      },
    })
  })

  it('preserves automatic-record semantics and clamps quantity while recalculating values', async () => {
    const existing = {
      id: 17,
      projectId: 42,
      materialName: '混凝土板',
      materialType: '其他',
      recyclingQuantity: 4,
      recyclingFactor: 2,
      recyclingCoefficient: 0.5,
      recyclingUnitPrice: 50,
      sourceBuildMaterialId: 7,
      isCustomMaterial: false,
    }
    const findFirst = vi.fn().mockResolvedValue(existing)
    const findUnique = vi.fn().mockResolvedValue({ id: 7, quantity: 10 })
    const update = vi.fn().mockResolvedValue({ id: 17, recyclingQuantity: 10 })
    const service = new RecyclingRecordService(
      {
        recyclingRecord: { findFirst, update },
        buildMaterial: { findUnique },
      } as unknown as PrismaService,
      { assertOwner: vi.fn().mockResolvedValue(undefined) } as unknown as RecordAccessService,
    )

    await expect(
      service.updateRecyclingRecord(42, 9, 17, {
        materialName: '不应修改',
        materialType: '金属',
        recyclingQuantity: 12,
        recyclingFactor: 99,
        recyclingCoefficient: 99,
        recyclingUnitPrice: 80,
      } as UpdateRecyclingRecordDto),
    ).resolves.toEqual({ id: 17, recyclingQuantity: 10 })

    expect(findFirst).toHaveBeenCalledWith({ where: { id: 17, projectId: 42 } })
    expect(findUnique).toHaveBeenCalledWith({ where: { id: 7 } })
    expect(update).toHaveBeenCalledWith({
      where: { id: 17 },
      data: {
        materialName: '混凝土板',
        materialType: '其他',
        recyclingQuantity: 10,
        recyclingFactor: 2,
        recyclingCoefficient: 0.5,
        recyclingUnitPrice: 80,
        reductionAmount: 0.01,
        residualValue: 0.08,
      },
    })
  })

  it('keeps owner-scoped lookup and the existing not-found error for updates', async () => {
    const assertOwner = vi.fn().mockResolvedValue(undefined)
    const findFirst = vi.fn().mockResolvedValue(null)
    const update = vi.fn()
    const service = new RecyclingRecordService(
      { recyclingRecord: { findFirst, update } } as unknown as PrismaService,
      { assertOwner } as unknown as RecordAccessService,
    )

    await expect(
      service.updateRecyclingRecord(42, 9, 17, {} as UpdateRecyclingRecordDto),
    ).rejects.toThrow('回收记录不存在')
    expect(assertOwner).toHaveBeenCalledWith(42, 9)
    expect(update).not.toHaveBeenCalled()
  })

  it('deletes only an existing owner-scoped record', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 17 })
    const remove = vi.fn().mockResolvedValue(undefined)
    const service = new RecyclingRecordService(
      { recyclingRecord: { findFirst, delete: remove } } as unknown as PrismaService,
      { assertOwner: vi.fn().mockResolvedValue(undefined) } as unknown as RecordAccessService,
    )

    await expect(service.removeRecyclingRecord(42, 9, 17)).resolves.toEqual({ deleted: true })
    expect(findFirst).toHaveBeenCalledWith({ where: { id: 17, projectId: 42 } })
    expect(remove).toHaveBeenCalledWith({ where: { id: 17 } })
  })
})
