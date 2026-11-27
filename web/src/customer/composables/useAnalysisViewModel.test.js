import { reactive, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { useAnalysisViewModel } from './useAnalysisViewModel.js'

function createModel(overrides = {}) {
  const inputs = {
    analysisSelectedStage: ref('建材碳排放'),
    analysisColors: ['#0071E3', '#86868B'],
    allMaterials: ref([]),
    countedTransportMaterials: ref([]),
    countedConstructionMaterials: ref([]),
    allRecyclingMaterials: ref([]),
    buildCarbonInfo: reactive({ totalEmission: 0 }),
    transportCarbonInfo: reactive({ totalEmission: 0 }),
    constructionCarbonInfo: reactive({ totalEmission: 0 }),
    recyclingCarbonInfo: reactive({ totalReduction: 0 }),
    ProjectInfo: reactive({ buildingArea: 0 }),
    ...overrides
  }
  return { inputs, model: useAnalysisViewModel(inputs) }
}

describe('useAnalysisViewModel', () => {
  it('uses the neutral gradient for empty and non-positive pie totals', () => {
    const { inputs, model } = createModel()
    expect(model.analysisPieGradient.value).toBe('conic-gradient(#E5EAE7 0deg 360deg)')
    inputs.allMaterials.value = [{ materialName: '抵减', quantity: 1, unit: 't', emissionFactor: 1, emissionAmount: -2 }]
    expect(model.analysisPieGradient.value).toBe('conic-gradient(#E5EAE7 0deg 360deg)')
  })

  it('converts construction emissions from kg to t in pie and lifecycle values', () => {
    const { inputs, model } = createModel({
      analysisSelectedStage: ref('施工碳排放'),
      countedConstructionMaterials: ref([{ machineryName: '塔吊', shiftCount: 2, emissionFactor: 3, emissionAmount: 2500 }]),
      constructionCarbonInfo: reactive({ totalEmission: 2500 })
    })
    expect(model.analysisPieItems.value[0].emission).toBe(2.5)
    expect(model.analysisLifecycleStages.value.find(stage => stage.name === '施工碳排放').emission).toBe(2.5)
    expect(inputs.constructionCarbonInfo.totalEmission).toBe(2500)
  })

  it('keeps recycling reductions negative in lifecycle net emissions', () => {
    const { model } = createModel({
      buildCarbonInfo: reactive({ totalEmission: 10 }),
      recyclingCarbonInfo: reactive({ totalReduction: 3 })
    })
    expect(model.analysisLifecycleStages.value.find(stage => stage.name === '回收碳计算').emission).toBe(-3)
    expect(model.analysisNetEmission.value).toBe(7)
  })

  it('sorts building material details by emission descending while retaining input rank', () => {
    const { model } = createModel({
      allMaterials: ref([
        { id: 1, materialName: '低', emissionAmount: 2 },
        { id: 2, materialName: '高', emissionAmount: 8 },
        { id: 3, materialName: '中', emissionAmount: 5 }
      ]),
      buildCarbonInfo: reactive({ totalEmission: 10 })
    })
    expect(model.analysisBuildMaterialDetails.value.map(({ materialName, rank, share }) => [materialName, rank, share])).toEqual([
      ['高', 2, 80], ['中', 3, 50], ['低', 1, 20]
    ])
  })

  it('uses buildingArea for unit-area emissions and returns zero for non-positive area', () => {
    const { inputs, model } = createModel({
      buildCarbonInfo: reactive({ totalEmission: 1.2 }),
      transportCarbonInfo: reactive({ totalEmission: 0.3 }),
      constructionCarbonInfo: reactive({ totalEmission: 500 }),
      recyclingCarbonInfo: reactive({ totalReduction: 0.1 }),
      ProjectInfo: reactive({ buildingArea: '100' })
    })
    expect(model.analysisUnitAreaEmission.value).toBe(19)
    inputs.ProjectInfo.buildingArea = 0
    expect(model.analysisUnitAreaEmission.value).toBe(0)
    inputs.ProjectInfo.buildingArea = -100
    expect(model.analysisUnitAreaEmission.value).toBe(0)
  })
})
