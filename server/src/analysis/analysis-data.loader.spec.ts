import { describe, expect, it, vi } from 'vitest'
import type { PrismaService } from '../prisma/prisma.service'
import type { ProjectsService } from '../projects/projects.service'
import { AnalysisDataLoader } from './analysis-data.loader'

const project = {
  projectName: '示例项目',
  province: '广东',
  cityDistrict: '深圳',
  address: '测试地址',
  buildingArea: 120,
  floorCount: '10',
  buildingType: '住宅',
  structureType: '框架',
  designLife: '50年',
  modelImage: null,
  modelImageName: '',
  startDate: '2025-01-01',
  plannedCompletionDate: '2026-01-01',
  projectManager: '项目经理',
  accountingStandard: 'GB/T 51366-2019',
}

describe('AnalysisDataLoader', () => {
  it('checks ownership first and loads every project-scoped query in the legacy order', async () => {
    const calls: string[] = []
    const assertOwner = vi.fn(async () => {
      calls.push('owner')
    })
    const findUnique = vi.fn(async () => {
      calls.push('project')
      return project
    })
    const findMany = (name: string, result: unknown) =>
      vi.fn(async (query: unknown) => {
        calls.push(name)
        expect(query).toEqual({ where: { projectId: 42 }, orderBy: { id: 'asc' } })
        return result
      })
    const buildFactors = [{ id: 1 }]
    const transportFactors = [{ id: 2 }]
    const buildMaterials = [{ id: 3 }]
    const transportRecords = [{ id: 4 }]
    const constructionRecords = [{ id: 5 }]
    const recyclingRecords = [{ id: 6 }]
    const prisma = {
      project: { findUnique },
      buildFactorConfig: { findMany: findMany('buildFactors', buildFactors) },
      transportFactorConfig: { findMany: findMany('transportFactors', transportFactors) },
      buildMaterial: { findMany: findMany('buildMaterials', buildMaterials) },
      transportRecord: { findMany: findMany('transportRecords', transportRecords) },
      constructionRecord: { findMany: findMany('constructionRecords', constructionRecords) },
      recyclingRecord: { findMany: findMany('recyclingRecords', recyclingRecords) },
    }
    const loader = new AnalysisDataLoader(
      prisma as unknown as PrismaService,
      { assertOwner } as unknown as ProjectsService,
    )

    const result = await loader.load(42, 7)

    expect(calls).toEqual([
      'owner',
      'project',
      'buildFactors',
      'transportFactors',
      'buildMaterials',
      'transportRecords',
      'constructionRecords',
      'recyclingRecords',
    ])
    expect(assertOwner).toHaveBeenCalledWith(42, 7)
    expect(findUnique).toHaveBeenCalledWith({ where: { id: 42 } })
    expect(result.projectInfo).toEqual({ ...project, accountingStages: ['建造生产阶段', '建造运输阶段', '施工建造阶段', '建造日常维护'] })
    expect(result.factors).toEqual({ build: buildFactors, transport: transportFactors })
    expect(result.buildMaterials).toEqual(buildMaterials)
    expect(result.transportRecords).toEqual(transportRecords)
    expect(result.constructionRecords).toEqual(constructionRecords)
    expect(result.recyclingRecords).toEqual(recyclingRecords)
    expect(result.buildingArea).toBe(120)
  })

  it('does not query project data when authorization fails', async () => {
    const error = new Error('ownership rejected')
    const assertOwner = vi.fn().mockRejectedValue(error)
    const findUnique = vi.fn()
    const loader = new AnalysisDataLoader(
      { project: { findUnique } } as unknown as PrismaService,
      { assertOwner } as unknown as ProjectsService,
    )

    await expect(loader.load(42, 7)).rejects.toBe(error)
    expect(findUnique).not.toHaveBeenCalled()
  })
})
