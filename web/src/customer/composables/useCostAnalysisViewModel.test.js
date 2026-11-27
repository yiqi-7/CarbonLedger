import { reactive, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { useCostAnalysisViewModel } from './useCostAnalysisViewModel.js'

function createViewModel({ materials = [], transport = [], construction = [], stage = '建材', buildingArea = 100, netEmission = 0 } = {}) {
  return useCostAnalysisViewModel({
    costAnalysisSelectedStage: ref(stage),
    allMaterials: ref(materials),
    countedTransportMaterials: ref(transport),
    countedConstructionMaterials: ref(construction),
    analysisNetEmission: ref(netEmission),
    ProjectInfo: reactive({ buildingArea })
  })
}

describe('useCostAnalysisViewModel', () => {
  it('computes total and building-material totals from their source rows', () => {
    const viewModel = createViewModel({
      materials: [{ id: 1, totalPrice: 10 }, { id: 2, totalPrice: 3 }],
      transport: [{ id: 3, transportTotalPrice: 4 }],
      construction: [{ id: 4, totalPrice: 2 }]
    })

    expect(viewModel.costAnalysisTotal.value).toBe(19)
    expect(viewModel.costAnalysisBuildTotal.value).toBe(13)
    expect(viewModel.costAnalysisTopBuildMaterial.value).toEqual({ id: 1, totalPrice: 10 })
  })

  it('uses building-material total and buildingArea for cost per area', () => {
    const viewModel = createViewModel({
      materials: [{ id: 1, totalPrice: 12 }],
      transport: [{ id: 2, transportTotalPrice: 30 }],
      buildingArea: 80
    })

    expect(viewModel.costAnalysisArea.value).toBe(0.15)
  })

  it('computes carbon intensity from net emissions divided by total cost', () => {
    const viewModel = createViewModel({
      materials: [{ id: 1, totalPrice: 12 }],
      transport: [{ id: 2, transportTotalPrice: 3 }],
      netEmission: 6
    })

    expect(viewModel.costAnalysisCarbonIntensity.value).toBe(0.4)
  })

  it.each([
    ['建材', [{ id: 1, materialName: '钢筋', type: '金属', totalPrice: 4 }], [], [], { name: '钢筋', detail: '金属', cost: 4 }],
    ['运输', [], [{ id: 2, vehicleName: '货车', transportedMaterial: '钢筋', transportTotalPrice: 7 }], [], { name: '货车', detail: '钢筋', cost: 7 }],
    ['施工', [], [], [{ id: 3, machineryName: '塔吊', energyType: '电力', totalPrice: 5 }], { name: '塔吊', detail: '电力', cost: 5 }]
  ])('selects %s rows for the chart', (stage, materials, transport, construction, expected) => {
    const viewModel = createViewModel({ stage, materials, transport, construction })

    expect(viewModel.costAnalysisChartItems.value).toEqual([{ id: expected.name === '钢筋' ? 1 : expected.name === '货车' ? 2 : 3, ...expected }])
  })

  it('sorts chart rows by descending cost and preserves chart item shape', () => {
    const viewModel = createViewModel({
      materials: [
        { id: 1, materialName: '低', type: '其他', totalPrice: 2 },
        { id: 2, materialName: '高', type: '金属', totalPrice: 9 },
        { id: 3, materialName: '中', type: '玻璃', totalPrice: 5 }
      ]
    })

    expect(viewModel.costAnalysisChartItems.value.map(item => item.name)).toEqual(['高', '中', '低'])
    expect(viewModel.costAnalysisChartMax.value).toBe(9 * 1.15)
  })

  it('returns empty rows and zero values when no records exist', () => {
    const viewModel = createViewModel({ buildingArea: 0 })

    expect(viewModel.costAnalysisTotal.value).toBe(0)
    expect(viewModel.costAnalysisBuildTotal.value).toBe(0)
    expect(viewModel.costAnalysisTopBuildMaterial.value).toBeNull()
    expect(viewModel.costAnalysisArea.value).toBe(0)
    expect(viewModel.costAnalysisCarbonIntensity.value).toBe(0)
    expect(viewModel.costAnalysisChartItems.value).toEqual([])
    expect(viewModel.costAnalysisChartMax.value).toBe(0)
    expect(viewModel.costAnalysisBuildDetails.value).toEqual([])
  })
})
