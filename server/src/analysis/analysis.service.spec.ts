import { describe, expect, it, vi } from 'vitest'
import type { AnalysisCalculator } from './analysis-calculator'
import type { AnalysisDataLoader } from './analysis-data.loader'
import { AnalysisService } from './analysis.service'

const data = {
  projectInfo: { projectName: '项目' },
  factors: { build: [], transport: [] },
  buildMaterials: [],
  transportRecords: [],
  constructionRecords: [],
  recyclingRecords: [],
  buildingArea: 100,
} as never

describe('AnalysisService', () => {
  it('keeps buildBundle as the public coordinator contract', async () => {
    const load = vi.fn().mockResolvedValue(data)
    const summary = { build: {}, transport: {}, construction: {}, recycling: {}, emission: {}, cost: {} }
    const calculate = vi.fn().mockReturnValue(summary)
    const service = new AnalysisService(
      { load } as unknown as AnalysisDataLoader,
      { calculate } as unknown as AnalysisCalculator,
    )

    await expect(service.buildBundle(42, 7)).resolves.toEqual({
      projectInfo: data.projectInfo,
      factors: data.factors,
      buildMaterials: data.buildMaterials,
      transportRecords: data.transportRecords,
      constructionRecords: data.constructionRecords,
      recyclingRecords: data.recyclingRecords,
      summary,
    })
    expect(load).toHaveBeenCalledWith(42, 7)
    expect(calculate).toHaveBeenCalledWith(data)
  })
})
