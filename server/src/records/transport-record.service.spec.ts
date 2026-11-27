import { describe, expect, it, vi } from 'vitest'
import type { PrismaService } from '../prisma/prisma.service'
import { TransportRecordService } from './transport-record.service'
import type { RecordAccessService } from './record-access.service'
import type { CreateTransportRecordDto } from './records.dto'
import type { ImportedTransportRecordsInput } from './import-inputs'

describe('TransportRecordService', () => {
  it('writes imported records with duplicate filtering, factor auto-fill, and derived fields', async () => {
    const findMany = vi.fn().mockResolvedValue([])
    const findFirst = vi.fn().mockResolvedValue(null)
    const createConfig = vi.fn().mockResolvedValue({})
    const createMany = vi.fn().mockResolvedValue({ count: 1 })
    const service = new TransportRecordService(
      {
        transportRecord: { findMany, createMany },
        transportFactorConfig: { findFirst, create: createConfig },
      } as unknown as PrismaService,
      {} as RecordAccessService,
    )
    const input = {
      records: [{ vehicleName: '自卸车', transportedMaterial: '砂石', transportQuantity: 3,
        transportDistance: 50, energyType: '柴油', emissionFactor: 2, transportUnitPrice: 0.8 }],
      skippedRows: 2,
    } as ImportedTransportRecordsInput

    await expect(service.importTransportRecords(7, input)).resolves.toEqual({ imported: 1, skippedRows: 2 })
    expect(findMany).toHaveBeenCalledWith({ where: { projectId: 7 } })
    expect(createConfig).toHaveBeenCalledWith({ data: { projectId: 7, vehicleName: '自卸车', energyType: '柴油', emissionFactor: 2 } })
    expect(createMany).toHaveBeenCalledWith({ data: [expect.objectContaining({ isCustomMaterial: false, emissionAmount: 0.3, transportTotalPrice: (50 * 0.8) / 10000 })] })
  })

  it('keeps owner check, factor lookup, and the legacy total-price formula', async () => {
    const assertOwner = vi.fn().mockResolvedValue(undefined)
    const findFirst = vi.fn().mockResolvedValue({
      vehicleName: '自卸车',
      energyType: '柴油',
      emissionFactor: 2,
    })
    const created = { id: 11 }
    const create = vi.fn().mockResolvedValue(created)
    const service = new TransportRecordService(
      {
        transportFactorConfig: { findFirst },
        transportRecord: { create },
      } as unknown as PrismaService,
      { assertOwner } as unknown as RecordAccessService,
    )

    const dto = {
      factorConfigId: 4,
      transportedMaterial: '砂石',
      transportQuantity: 3,
      transportDistance: 50,
      transportUnitPrice: 0.8,
    } as CreateTransportRecordDto

    await expect(service.createTransportRecord(7, 9, dto)).resolves.toBe(created)
    expect(assertOwner).toHaveBeenCalledWith(7, 9)
    expect(findFirst).toHaveBeenCalledWith({ where: { id: 4, projectId: 7 } })
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: 7,
        transportQuantity: 3,
        transportDistance: 50,
        transportUnitPrice: 0.8,
        emissionAmount: 0.3,
        transportTotalPrice: (50 * 0.8) / 10000,
      }),
    })
  })
})
