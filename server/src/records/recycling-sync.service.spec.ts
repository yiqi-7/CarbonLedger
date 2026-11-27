import { describe, expect, it, vi } from 'vitest'
import type { PrismaService } from '../prisma/prisma.service'
import { RecyclingSyncService } from './recycling-sync.service'

describe('RecyclingSyncService', () => {
  it('updates only the scoped automatic record, clamps quantity, and preserves its unit price', async () => {
    const findBuildMaterials = vi.fn().mockResolvedValue([
      {
        id: 7,
        projectId: 42,
        materialName: '混凝土板',
        type: '混凝土',
        quantity: 10,
        unit: '吨',
        recyclingFactor: 2,
        recyclingCoefficient: 0.5,
      },
    ])
    const findRecyclingRecords = vi.fn().mockResolvedValue([
      {
        id: 17,
        projectId: 42,
        sourceBuildMaterialId: 7,
        isCustomMaterial: false,
        recyclingQuantity: 12,
        recyclingUnitPrice: 50,
      },
      {
        id: 18,
        projectId: 42,
        sourceBuildMaterialId: null,
        isCustomMaterial: true,
        recyclingQuantity: 3,
        recyclingUnitPrice: 99,
      },
    ])
    const update = vi.fn().mockResolvedValue(undefined)
    const create = vi.fn()
    const deleteMany = vi.fn()
    const service = new RecyclingSyncService({
      buildMaterial: { findMany: findBuildMaterials },
      recyclingRecord: {
        findMany: findRecyclingRecords,
        update,
        create,
        deleteMany,
      },
    } as unknown as PrismaService)

    await service.syncRecycling(42, [7])

    expect(findBuildMaterials).toHaveBeenCalledWith({
      where: { projectId: 42, id: { in: [7] } },
    })
    expect(findRecyclingRecords).toHaveBeenCalledWith({
      where: { projectId: 42, sourceBuildMaterialId: { in: [7] } },
    })
    expect(update).toHaveBeenCalledWith({
      where: { id: 17 },
      data: {
        materialName: '混凝土板',
        materialType: '其他',
        recyclingQuantity: 10,
        unit: '吨',
        recyclingFactor: 2,
        recyclingCoefficient: 0.5,
        recyclingUnitPrice: 50,
        reductionAmount: 0.01,
        residualValue: 0.05,
      },
    })
    expect(create).not.toHaveBeenCalled()
    expect(deleteMany).not.toHaveBeenCalled()
  })
})
