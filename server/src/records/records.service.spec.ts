import { describe, expect, it, vi } from 'vitest'
import type { PrismaService } from '../prisma/prisma.service'
import type { BuildRecordService } from './build-record.service'
import type { RecordAccessService } from './record-access.service'
import { RecordsService } from './records.service'
import type { RecyclingSyncService } from './recycling-sync.service'
import type {
  CreateBuildMaterialDto,
  UpdateBuildMaterialDto,
} from './records.dto'

describe('RecordsService', () => {
  const createService = (buildRecords: Partial<BuildRecordService>) => {
    return new RecordsService(
      {} as PrismaService,
      {} as RecordAccessService,
      {} as RecyclingSyncService,
      buildRecords as BuildRecordService,
    )
  }

  it('delegates build-material public methods with the original arguments and results', async () => {
    const listResult = [{ id: 1 }]
    const createResult = { id: 2 }
    const updateResult = { id: 3 }
    const removeResult = { deleted: true as const }
    const buildRecords = {
      listBuildMaterials: vi.fn().mockResolvedValue(listResult),
      createBuildMaterial: vi.fn().mockResolvedValue(createResult),
      updateBuildMaterial: vi.fn().mockResolvedValue(updateResult),
      removeBuildMaterial: vi.fn().mockResolvedValue(removeResult),
    }
    const service = createService(buildRecords)
    const createDto = {} as CreateBuildMaterialDto
    const updateDto = {} as UpdateBuildMaterialDto

    await expect(service.listBuildMaterials(42, 7)).resolves.toBe(listResult)
    await expect(service.createBuildMaterial(42, 7, createDto)).resolves.toBe(createResult)
    await expect(service.updateBuildMaterial(42, 7, 9, updateDto)).resolves.toBe(updateResult)
    await expect(service.removeBuildMaterial(42, 7, 9)).resolves.toBe(removeResult)

    expect(buildRecords.listBuildMaterials).toHaveBeenCalledWith(42, 7)
    expect(buildRecords.createBuildMaterial).toHaveBeenCalledWith(42, 7, createDto)
    expect(buildRecords.updateBuildMaterial).toHaveBeenCalledWith(42, 7, 9, updateDto)
    expect(buildRecords.removeBuildMaterial).toHaveBeenCalledWith(42, 7, 9)
  })

  it('delegates syncRecycling to RecyclingSyncService with the original arguments', async () => {
    const syncRecycling = vi.fn().mockResolvedValue(undefined)
    const service = new RecordsService(
      {} as PrismaService,
      {} as RecordAccessService,
      { syncRecycling } as unknown as RecyclingSyncService,
      {} as BuildRecordService,
    )

    await expect(service.syncRecycling(42, [7, 8])).resolves.toBeUndefined()

    expect(syncRecycling).toHaveBeenCalledTimes(1)
    expect(syncRecycling).toHaveBeenCalledWith(42, [7, 8])
  })
})
