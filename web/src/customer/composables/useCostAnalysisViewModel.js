import { computed, unref } from 'vue'

// Inputs may be refs/computed values or plain reactive objects.
export function useCostAnalysisViewModel(options) {
  const {
    costAnalysisSelectedStage,
    allMaterials,
    countedTransportMaterials,
    countedConstructionMaterials,
    analysisNetEmission,
    ProjectInfo
  } = options

  const costAnalysisTotal = computed(() =>
    unref(allMaterials).reduce((total, material) => total + material.totalPrice, 0) +
    unref(countedTransportMaterials).reduce((total, material) => total + material.transportTotalPrice, 0) +
    unref(countedConstructionMaterials).reduce((total, material) => total + material.totalPrice, 0)
  )
  const costAnalysisBuildTotal = computed(() =>
    unref(allMaterials).reduce((total, material) => total + material.totalPrice, 0)
  )
  const costAnalysisTopBuildMaterial = computed(() =>
    unref(allMaterials).reduce(
      (highest, material) => !highest || material.totalPrice > highest.totalPrice ? material : highest,
      null
    )
  )
  const costAnalysisArea = computed(() => {
    const area = Number(unref(ProjectInfo).buildingArea) || 0
    return area > 0 ? costAnalysisBuildTotal.value / area : 0
  })
  const costAnalysisCarbonIntensity = computed(() =>
    costAnalysisTotal.value > 0 ? unref(analysisNetEmission) / costAnalysisTotal.value : 0
  )
  const costAnalysisChartItems = computed(() => {
    let items
    if (unref(costAnalysisSelectedStage) === '运输') {
      items = unref(countedTransportMaterials).map(material => ({
        id: material.id,
        name: material.vehicleName,
        detail: material.transportedMaterial,
        cost: material.transportTotalPrice
      }))
    } else if (unref(costAnalysisSelectedStage) === '施工') {
      items = unref(countedConstructionMaterials).map(material => ({
        id: material.id,
        name: material.machineryName,
        detail: material.energyType,
        cost: material.totalPrice
      }))
    } else {
      items = unref(allMaterials).map(material => ({
        id: material.id,
        name: material.materialName,
        detail: material.type,
        cost: material.totalPrice
      }))
    }
    return items.sort((left, right) => right.cost - left.cost)
  })
  const costAnalysisChartMax = computed(() =>
    Math.max(...costAnalysisChartItems.value.map(item => item.cost), 0) * 1.15
  )
  const costAnalysisChartTicks = computed(() =>
    [1, 0.75, 0.5, 0.25, 0].map(ratio => ({
      ratio,
      value: costAnalysisChartMax.value * ratio
    }))
  )
  const costAnalysisBuildDetails = computed(() =>
    unref(allMaterials)
      .map(material => ({
        ...material,
        costShare: costAnalysisTotal.value > 0 ? material.totalPrice / costAnalysisTotal.value * 100 : 0,
        carbonCostIntensity: material.totalPrice > 0 ? material.emissionAmount * 1000 / (material.totalPrice * 10000) : null
      }))
      .sort((left, right) => right.totalPrice - left.totalPrice)
  )

  return {
    costAnalysisTotal,
    costAnalysisBuildTotal,
    costAnalysisTopBuildMaterial,
    costAnalysisArea,
    costAnalysisCarbonIntensity,
    costAnalysisChartItems,
    costAnalysisChartMax,
    costAnalysisChartTicks,
    costAnalysisBuildDetails
  }
}
