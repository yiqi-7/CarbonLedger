import { describe, expect, it, vi } from 'vitest'
import type { PrismaService } from '../prisma/prisma.service'
import { BuildRecordService } from './build-record.service'
import type { RecordAccessService } from './record-access.service'
import type { RecyclingSyncService } from './recycling-sync.service'
import type { CreateBuildMaterialDto } from './records.dto'
import type { ImportedBuildMaterialsInput } from './import-inputs'

describe('BuildRecordService', () => {
  it('writes authorized imported materials with legacy resolution and sync order', async () => {
    const calls: string[] = []
    const findMany = vi.fn(async () => {
      calls.push('existing')
      return []
    })
    const findConfigs = vi.fn(async () => {
      calls.push('configs')
      return [{ name: '混凝土', category: '混凝土', materialUnit: 'm³' }]
    })
    const create = vi.fn(async () => {
      calls.push('create')
      return { id: 11 }
    })
    const transaction = vi.fn(async (operations: unknown[]) => {
      calls.push('transaction')
      return Promise.all(operations as Promise<{ id: number }>[])
    })
    const syncRecycling = vi.fn(async () => {
      calls.push('sync')
    })
    const service = new BuildRecordService(
      {
        buildMaterial: { findMany, create },
        buildFactorConfig: { findMany: findConfigs },
        $transaction: transaction,
      } as unknown as PrismaService,
      {} as RecordAccessService,
      { syncRecycling } as unknown as RecyclingSyncService,
    )
    const input = {
      materials: [{
        materialName: '混凝土', type: '混凝土', quantity: 3, unit: '', emissionFactor: 2.5,
        marketPrice: null, unitPrice: 10, recyclingFactor: 0.2, recyclingCoefficient: 0.4,
      }],
    } as ImportedBuildMaterialsInput

    await expect(service.importBuildMaterials(7, input)).resolves.toEqual({ imported: 1, skippedRows: 0 })
    expect(calls).toEqual(['existing', 'configs', 'create', 'transaction', 'sync'])
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ isCustomMaterial: false, unit: 'm³' }) })
    expect(syncRecycling).toHaveBeenCalledWith(7, [11])
  })

  it('keeps owner check, factor config lookup, persistence, and recycling sync order', async () => {
    const calls: string[] = []
    const config = {
      name: '混凝土',
      category: '混凝土',
      materialUnit: 'm³',
      emissionFactor: 2.5,
      recyclingFactor: 0.2,
      recyclingCoefficient: 0.4,
    }
    const created = { id: 11 }
    const assertOwner = vi.fn(async () => {
      calls.push('owner')
    })
    const findFirst = vi.fn(async () => {
      calls.push('config')
      return config
    })
    const create = vi.fn(async () => {
      calls.push('create')
      return created
    })
    const syncRecycling = vi.fn(async () => {
      calls.push('sync')
    })
    const service = new BuildRecordService(
      {
        buildFactorConfig: { findFirst },
        buildMaterial: { create },
      } as unknown as PrismaService,
      { assertOwner } as unknown as RecordAccessService,
      { syncRecycling } as unknown as RecyclingSyncService,
    )

    const dto = {
      factorConfigId: 4,
      quantity: 3,
      unitPrice: 10,
    } as CreateBuildMaterialDto
    await expect(service.createBuildMaterial(7, 9, dto)).resolves.toBe(created)

    expect(calls).toEqual(['owner', 'config', 'create', 'sync'])
    expect(findFirst).toHaveBeenCalledWith({ where: { id: 4, projectId: 7 } })
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: 7,
        materialName: '混凝土',
        type: '混凝土',
        quantity: 3,
        unit: 'm³',
        emissionFactor: 2.5,
        recyclingFactor: 0.2,
        recyclingCoefficient: 0.4,
      }),
    })
    expect(syncRecycling).toHaveBeenCalledWith(7, [11])
  })

  it('preserves the missing factor config error and skips persistence/sync', async () => {
    const create = vi.fn()
    const syncRecycling = vi.fn()
    const service = new BuildRecordService(
      {
        buildFactorConfig: { findFirst: vi.fn().mockResolvedValue(null) },
        buildMaterial: { create },
      } as unknown as PrismaService,
      { assertOwner: vi.fn().mockResolvedValue(undefined) } as unknown as RecordAccessService,
      { syncRecycling } as unknown as RecyclingSyncService,
    )

    await expect(
      service.createBuildMaterial(7, 9, {
        factorConfigId: 4,
        quantity: 3,
        unitPrice: 10,
      } as CreateBuildMaterialDto),
    ).rejects.toThrow('建材因子配置不存在')
    expect(create).not.toHaveBeenCalled()
    expect(syncRecycling).not.toHaveBeenCalled()
  })
})
