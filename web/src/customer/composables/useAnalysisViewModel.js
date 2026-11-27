import { computed, unref } from 'vue'

// Inputs may be refs/computed values or plain reactive objects.
export function useAnalysisViewModel(options) {
  const {
    analysisSelectedStage,
    analysisColors,
    allMaterials,
    countedTransportMaterials,
    countedConstructionMaterials,
    allRecyclingMaterials,
    buildCarbonInfo,
    transportCarbonInfo,
    constructionCarbonInfo,
    recyclingCarbonInfo,
    ProjectInfo
  } = options

  const analysisPieItems = computed(() => {
    if (unref(analysisSelectedStage) === '建材碳排放') {
      return unref(allMaterials).map(material => ({
        name: material.materialName,
        quantity: material.quantity,
        unit: material.unit,
        factor: material.emissionFactor,
        emission: material.emissionAmount
      }))
    }
    if (unref(analysisSelectedStage) === '运输碳排放') {
      return unref(countedTransportMaterials).map(material => ({
        name: material.transportedMaterial,
        quantity: material.transportQuantity,
        unit: 't',
        factor: material.emissionFactor,
        emission: material.emissionAmount
      }))
    }
    if (unref(analysisSelectedStage) === '施工碳排放') {
      return unref(countedConstructionMaterials).map(material => ({
        name: material.machineryName,
        quantity: material.shiftCount,
        unit: '台班',
        factor: material.emissionFactor,
        emission: material.emissionAmount / 1000
      }))
    }
    return unref(allRecyclingMaterials).map(material => ({
      name: material.materialName,
      quantity: material.recyclingQuantity,
      unit: material.unit,
      factor: material.recyclingFactor * material.recyclingCoefficient,
      emission: material.reductionAmount
    }))
  })
  const analysisPieTotal = computed(() =>
    analysisPieItems.value.reduce((total, item) => total + item.emission, 0)
  )
  const analysisPieGradient = computed(() => {
    if (analysisPieTotal.value <= 0) return 'conic-gradient(#E5EAE7 0deg 360deg)'
    let currentAngle = 0
    const segments = analysisPieItems.value.map((item, index) => {
      const start = currentAngle
      currentAngle += item.emission / analysisPieTotal.value * 360
      return `${unref(analysisColors)[index % unref(analysisColors).length]} ${start}deg ${currentAngle}deg`
    })
    return `conic-gradient(${segments.join(', ')})`
  })
  const analysisLifecycleStages = computed(() => [
    { name: '建材碳排放', emission: unref(buildCarbonInfo).totalEmission, color: '#0071E3' },
    { name: '运输碳排放', emission: unref(transportCarbonInfo).totalEmission, color: '#86868B' },
    { name: '施工碳排放', emission: unref(constructionCarbonInfo).totalEmission / 1000, color: '#6E6E73' },
    { name: '回收碳计算', emission: -unref(recyclingCarbonInfo).totalReduction, color: '#34C759' }
  ])
  const analysisNetEmission = computed(() =>
    analysisLifecycleStages.value.reduce((total, stage) => total + stage.emission, 0)
  )
  const analysisUnitAreaEmission = computed(() => {
    const area = Number(unref(ProjectInfo).buildingArea) || 0
    return area > 0 ? analysisNetEmission.value * 1000 / area : 0
  })
  const analysisMaxStageEmission = computed(() =>
    Math.max(0, ...analysisLifecycleStages.value.map(stage => Math.abs(stage.emission)))
  )
  const analysisBuildMaterialDetails = computed(() => {
    const total = unref(buildCarbonInfo).totalEmission
    return unref(allMaterials)
      .map((material, index) => ({
        ...material,
        rank: index + 1,
        share: total > 0 ? material.emissionAmount / total * 100 : 0
      }))
      .sort((left, right) => right.emissionAmount - left.emissionAmount)
  })

  return {
    analysisPieItems,
    analysisPieTotal,
    analysisPieGradient,
    analysisLifecycleStages,
    analysisNetEmission,
    analysisUnitAreaEmission,
    analysisMaxStageEmission,
    analysisBuildMaterialDetails
  }
}
