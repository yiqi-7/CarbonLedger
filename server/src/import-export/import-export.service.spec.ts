import { describe, expect, it, vi } from 'vitest'
import type { RecordAccessService } from '../records/record-access.service'
import type { RecordsService } from '../records/records.service'
import type { AnalysisService } from '../analysis/analysis.service'
import { ImportExportService } from './import-export.service'

function createService(
  access: RecordAccessService,
  records: Partial<RecordsService> = {},
): ImportExportService {
  return new ImportExportService(
    access,
    records as RecordsService,
    {} as AnalysisService,
  )
}

describe('ImportExportService 导入权限边界', () => {
  it('authorizes before workbook parsing and delegation', async () => {
    const calls: string[] = []
    const assertOwner = vi.fn(async () => { calls.push('owner') })
    const importBuildMaterials = vi.fn(async (_projectId: number, input: { materials: unknown[] }) => {
      calls.push('write')
      expect(input.materials).toHaveLength(0)
      return { imported: 0, skippedRows: 0 }
    })
    const service = createService({ assertOwner } as unknown as RecordAccessService, { importBuildMaterials })
    await expect(service.importBuildMaterials(42, 7, Buffer.from('invalid'))).rejects.toThrow('Excel文件无法解析')
    expect(calls).toEqual(['owner'])
    expect(importBuildMaterials).not.toHaveBeenCalled()
  })

  it.each([
    ['建材', 'importBuildMaterials', 'importBuildMaterials'],
    ['运输', 'importTransportRecords', 'importTransportRecords'],
    ['施工', 'importConstructionRecords', 'importConstructionRecords'],
  ] as const)('在%s导入被拒绝时只调用 access.assertOwner，不调用 RecordsService', async (_label, method, recordMethod) => {
    const error = new Error('ownership rejected')
    const assertOwner = vi.fn().mockRejectedValue(error)
    const access = { assertOwner } as unknown as RecordAccessService
    const records = { [recordMethod]: vi.fn() }
    const service = createService(access, records)

    await expect(service[method](42, 7, Buffer.alloc(0))).rejects.toBe(error)

    expect(assertOwner).toHaveBeenCalledTimes(1)
    expect(assertOwner).toHaveBeenCalledWith(42, 7)
    expect(records[recordMethod]).not.toHaveBeenCalled()
  })
})
