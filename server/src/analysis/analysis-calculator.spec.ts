import { describe, expect, it } from 'vitest'
import type { AnalysisData } from './analysis-data.loader'
import { AnalysisCalculator } from './analysis-calculator'

const data: AnalysisData = {
  projectInfo: {
    projectName: '项目',
    province: '',
    cityDistrict: '',
    address: '',
    buildingArea: 100,
    floorCount: '',
    buildingType: '',
    structureType: '',
    designLife: '',
    modelImage: null,
    modelImageName: '',
    startDate: '',
    plannedCompletionDate: '',
    projectManager: '',
    accountingStandard: 'GB/T 51366-2019',
    accountingStages: [],
  },
  factors: { build: [], transport: [] },
  buildMaterials: [
    {
      id: 1,
      materialName: '钢材',
      type: '金属',
      quantity: 1000,
      unit: 'kg',
      emissionFactor: 2,
      marketPrice: null,
      unitPrice: 10,
      recyclingFactor: 0,
      recyclingCoefficient: 0,
      isCustomMaterial: false,
      emissionAmount: 2,
      totalPrice: 1,
      isParticipatingInRecyclingCalculation: false,
    },
  ],
  transportRecords: [],
  constructionRecords: [],
  recyclingRecords: [],
  buildingArea: 100,
}

describe('AnalysisCalculator', () => {
  it('preserves the shared summary formulas and DTO shapes', () => {
    const summary = new AnalysisCalculator().calculate(data)

    expect(summary.build).toEqual({ totalEmission: 2, totalMaterialCost: 1, emissionPerArea: 20 })
    expect(summary.transport.totalEmission).toBe(0)
    expect(summary.construction.totalEmission).toBe(0)
    expect(summary.recycling).toEqual({
      totalReduction: 0,
      totalRecyclingQuantity: 0,
      recyclingUtilizationRate: 0,
      estimatedResidualValue: 0,
    })
    expect(summary.emission.netEmission).toBe(2)
    expect(summary.emission.unitAreaNetEmission).toBe(20)
    expect(summary.emission.buildMaterialDetails).toEqual([
      {
        id: 1,
        rank: 1,
        materialName: '钢材',
        type: '金属',
        emissionAmount: 2,
        quantity: 1000,
        unit: 'kg',
        emissionFactor: 2,
        share: 100,
      },
    ])
    expect(summary.cost).toMatchObject({
      totalCost: 1,
      buildCost: 1,
      topBuildMaterial: { id: 1, materialName: '钢材', totalPrice: 1, shareOfBuildCost: 100 },
      unitAreaBuildCost: 0.01,
      unitCostEmission: 2,
    })
  })
})
