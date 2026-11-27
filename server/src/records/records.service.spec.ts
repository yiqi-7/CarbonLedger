import { describe, expect, it, vi } from 'vitest'
import type { BuildRecordService } from './build-record.service'
import type { ConstructionRecordService } from './construction-record.service'
import { RecordsService } from './records.service'
import type { RecyclingRecordService } from './recycling-record.service'
import type { RecyclingSyncService } from './recycling-sync.service'
import type { TransportRecordService } from './transport-record.service'
import type {
  CreateBuildMaterialDto,
  CreateConstructionRecordDto,
  CreateRecyclingRecordDto,
  CreateTransportRecordDto,
  UpdateBuildMaterialDto,
  UpdateConstructionRecordDto,
  UpdateRecyclingRecordDto,
  UpdateTransportRecordDto,
} from './records.dto'
import type {
  ImportedBuildMaterialsInput,
  ImportedConstructionRecordsInput,
  ImportedTransportRecordsInput,
} from './import-inputs'

describe('RecordsService', () => {
  const createService = (
    buildRecords: Partial<BuildRecordService>,
    transportRecords: Partial<TransportRecordService> = {},
    constructionRecords: Partial<ConstructionRecordService> = {},
    recyclingRecords: Partial<RecyclingRecordService> = {},
  ) => {
    return new RecordsService(
      {} as RecyclingSyncService,
      recyclingRecords as RecyclingRecordService,
      buildRecords as BuildRecordService,
      constructionRecords as ConstructionRecordService,
      transportRecords as TransportRecordService,
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

  it('delegates all construction public methods with original arguments and results', async () => {
    const listResult = [{ id: 1 }]
    const createResult = { id: 2 }
    const updateResult = { id: 3 }
    const removeResult = { deleted: true as const }
    const constructionRecords = {
      listConstructionRecords: vi.fn().mockResolvedValue(listResult),
      createConstructionRecord: vi.fn().mockResolvedValue(createResult),
      updateConstructionRecord: vi.fn().mockResolvedValue(updateResult),
      removeConstructionRecord: vi.fn().mockResolvedValue(removeResult),
    }
    const service = createService({}, {}, constructionRecords)
    const createDto = {} as CreateConstructionRecordDto
    const updateDto = {} as UpdateConstructionRecordDto

    await expect(service.listConstructionRecords(42, 7)).resolves.toBe(listResult)
    await expect(service.createConstructionRecord(42, 7, createDto)).resolves.toBe(createResult)
    await expect(service.updateConstructionRecord(42, 7, 9, updateDto)).resolves.toBe(updateResult)
    await expect(service.removeConstructionRecord(42, 7, 9)).resolves.toBe(removeResult)

    expect(constructionRecords.listConstructionRecords).toHaveBeenCalledWith(42, 7)
    expect(constructionRecords.createConstructionRecord).toHaveBeenCalledWith(42, 7, createDto)
    expect(constructionRecords.updateConstructionRecord).toHaveBeenCalledWith(42, 7, 9, updateDto)
    expect(constructionRecords.removeConstructionRecord).toHaveBeenCalledWith(42, 7, 9)
  })

  it('delegates all transport public methods with original arguments and results', async () => {
    const listResult = [{ id: 1 }]
    const createResult = { id: 2 }
    const updateResult = { id: 3 }
    const removeResult = { deleted: true as const }
    const transportRecords = {
      listTransportRecords: vi.fn().mockResolvedValue(listResult),
      createTransportRecord: vi.fn().mockResolvedValue(createResult),
      updateTransportRecord: vi.fn().mockResolvedValue(updateResult),
      removeTransportRecord: vi.fn().mockResolvedValue(removeResult),
    }
    const service = createService({}, transportRecords)
    const createDto = {} as CreateTransportRecordDto
    const updateDto = {} as UpdateTransportRecordDto

    await expect(service.listTransportRecords(42, 7)).resolves.toBe(listResult)
    await expect(service.createTransportRecord(42, 7, createDto)).resolves.toBe(createResult)
    await expect(service.updateTransportRecord(42, 7, 9, updateDto)).resolves.toBe(updateResult)
    await expect(service.removeTransportRecord(42, 7, 9)).resolves.toBe(removeResult)

    expect(transportRecords.listTransportRecords).toHaveBeenCalledWith(42, 7)
    expect(transportRecords.createTransportRecord).toHaveBeenCalledWith(42, 7, createDto)
    expect(transportRecords.updateTransportRecord).toHaveBeenCalledWith(42, 7, 9, updateDto)
    expect(transportRecords.removeTransportRecord).toHaveBeenCalledWith(42, 7, 9)
  })

  it('delegates all recycling public methods with original arguments and results', async () => {
    const listResult = [{ id: 1 }]
    const createResult = { id: 2 }
    const updateResult = { id: 3 }
    const removeResult = { deleted: true as const }
    const recyclingRecords = {
      listRecyclingRecords: vi.fn().mockResolvedValue(listResult),
      createRecyclingRecord: vi.fn().mockResolvedValue(createResult),
      updateRecyclingRecord: vi.fn().mockResolvedValue(updateResult),
      removeRecyclingRecord: vi.fn().mockResolvedValue(removeResult),
    }
    const service = createService({}, {}, {}, recyclingRecords)
    const createDto = {} as CreateRecyclingRecordDto
    const updateDto = {} as UpdateRecyclingRecordDto

    await expect(service.listRecyclingRecords(42, 7)).resolves.toBe(listResult)
    await expect(service.createRecyclingRecord(42, 7, createDto)).resolves.toBe(createResult)
    await expect(service.updateRecyclingRecord(42, 7, 9, updateDto)).resolves.toBe(updateResult)
    await expect(service.removeRecyclingRecord(42, 7, 9)).resolves.toBe(removeResult)

    expect(recyclingRecords.listRecyclingRecords).toHaveBeenCalledWith(42, 7)
    expect(recyclingRecords.createRecyclingRecord).toHaveBeenCalledWith(42, 7, createDto)
    expect(recyclingRecords.updateRecyclingRecord).toHaveBeenCalledWith(42, 7, 9, updateDto)
    expect(recyclingRecords.removeRecyclingRecord).toHaveBeenCalledWith(42, 7, 9)
  })

  it('delegates authorized import coordination to the matching child services', async () => {
    const buildInput = { materials: [] } as ImportedBuildMaterialsInput
    const transportInput = { records: [], skippedRows: 2 } as ImportedTransportRecordsInput
    const constructionInput = { records: [], skippedRows: 3 } as ImportedConstructionRecordsInput
    const buildResult = { imported: 1, skippedRows: 4 }
    const transportResult = { imported: 2, skippedRows: 5 }
    const constructionResult = { imported: 3, skippedRows: 6 }
    const buildRecords = { importBuildMaterials: vi.fn().mockResolvedValue(buildResult) }
    const transportRecords = { importTransportRecords: vi.fn().mockResolvedValue(transportResult) }
    const constructionRecords = { importConstructionRecords: vi.fn().mockResolvedValue(constructionResult) }
    const service = createService(buildRecords, transportRecords, constructionRecords)

    await expect(service.importBuildMaterials(42, buildInput)).resolves.toBe(buildResult)
    await expect(service.importTransportRecords(42, transportInput)).resolves.toBe(transportResult)
    await expect(service.importConstructionRecords(42, constructionInput)).resolves.toBe(constructionResult)

    expect(buildRecords.importBuildMaterials).toHaveBeenCalledWith(42, buildInput)
    expect(transportRecords.importTransportRecords).toHaveBeenCalledWith(42, transportInput)
    expect(constructionRecords.importConstructionRecords).toHaveBeenCalledWith(42, constructionInput)
  })

  it('delegates syncRecycling to RecyclingSyncService with the original arguments', async () => {
    const syncRecycling = vi.fn().mockResolvedValue(undefined)
    const service = new RecordsService(
      { syncRecycling } as unknown as RecyclingSyncService,
      {} as RecyclingRecordService,
      {} as BuildRecordService,
      {} as ConstructionRecordService,
      {} as TransportRecordService,
    )

    await expect(service.syncRecycling(42, [7, 8])).resolves.toBeUndefined()

    expect(syncRecycling).toHaveBeenCalledTimes(1)
    expect(syncRecycling).toHaveBeenCalledWith(42, [7, 8])
  })
})
