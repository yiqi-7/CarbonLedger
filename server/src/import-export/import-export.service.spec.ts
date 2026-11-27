import { describe, expect, it, vi } from 'vitest'
import type { PrismaService } from '../prisma/prisma.service'
import type { RecordAccessService } from '../records/record-access.service'
import type { RecordsService } from '../records/records.service'
import type { AnalysisService } from '../analysis/analysis.service'
import { ImportExportService } from './import-export.service'

function createService(access: RecordAccessService, prisma: PrismaService): ImportExportService {
  return new ImportExportService(
    prisma,
    access,
    {} as RecordsService,
    {} as AnalysisService,
  )
}

describe('ImportExportService 导入权限边界', () => {
  it.each([
    ['建材', 'importBuildMaterials', 'buildMaterial'],
    ['运输', 'importTransportRecords', 'transportRecord'],
    ['施工', 'importConstructionRecords', 'constructionRecord'],
  ] as const)('在%s导入被拒绝时只调用 access.assertOwner，不访问 Prisma', async (_label, method, model) => {
    const error = new Error('ownership rejected')
    const assertOwner = vi.fn().mockRejectedValue(error)
    const access = { assertOwner } as unknown as RecordAccessService
    const prismaModel = { findMany: vi.fn(), createMany: vi.fn() }
    const prisma = {
      buildMaterial: { ...prismaModel },
      buildFactorConfig: { findMany: vi.fn() },
      transportRecord: { ...prismaModel },
      transportFactorConfig: { findFirst: vi.fn(), create: vi.fn() },
      constructionRecord: { ...prismaModel },
    } as unknown as PrismaService
    const service = createService(access, prisma)

    await expect(service[method](42, 7, Buffer.alloc(0))).rejects.toBe(error)

    expect(assertOwner).toHaveBeenCalledTimes(1)
    expect(assertOwner).toHaveBeenCalledWith(42, 7)
    expect((prisma[model] as { findMany: ReturnType<typeof vi.fn> }).findMany).not.toHaveBeenCalled()
    if (model === 'buildMaterial') {
      expect(prisma.buildFactorConfig.findMany).not.toHaveBeenCalled()
    }
    if (model === 'transportRecord') {
      expect(prisma.transportFactorConfig.findFirst).not.toHaveBeenCalled()
      expect(prisma.transportFactorConfig.create).not.toHaveBeenCalled()
    }
  })
})
