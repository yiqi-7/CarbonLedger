import { computed, unref } from 'vue'

// Inputs may be refs/computed values or plain reactive objects.
export function useRecordFilters(options) {
  const {
    allMaterials,
    allRecyclingMaterials,
    allConstructionMaterials,
    allTransportMaterials,
    materialCategory,
    materialSearch,
    recyclingCategory,
    recyclingSearch,
    constructionCategory,
    constructionSearch,
    transportCategory,
    transportSearch,
  } = options

  const recyclingQuantityGroups = computed(() => {
    const groups = new Map()
    const aliases = {
      '㎡': 'm²',
      m2: 'm²',
      'm^2': 'm²',
      '平方米': 'm²',
      '㎥': 'm³',
      m3: 'm³',
      'm^3': 'm³',
      '立方米': 'm³',
      '吨': 't',
      '千克': 'kg',
      '公斤': 'kg',
    }
    for (const material of unref(allRecyclingMaterials)) {
      const rawUnit = String(material.unit ?? '').trim()
      const unit = (aliases[rawUnit] ?? rawUnit) || '未标注单位'
      groups.set(unit, (groups.get(unit) ?? 0) + material.recyclingQuantity)
    }
    return [...groups].map(([unit, quantity]) => ({ unit, quantity }))
  })

  const filteredMaterials = computed(() => {
    const query = unref(materialSearch).trim().toLocaleLowerCase()
    return unref(allMaterials).filter(material => {
      const matchesCategory = unref(materialCategory) === '全部' || material.type === unref(materialCategory)
      const matchesName = !query || material.materialName.toLocaleLowerCase() === query
      return matchesCategory && matchesName
    })
  })

  const filteredRecyclingMaterials = computed(() => {
    const query = unref(recyclingSearch).trim().toLocaleLowerCase()
    return unref(allRecyclingMaterials).filter(material => {
      const matchesCategory = unref(recyclingCategory) === '全部回收' || material.materialType === unref(recyclingCategory)
      const matchesName = !query || material.materialName.toLocaleLowerCase() === query
      return matchesCategory && matchesName
    })
  })

  const filteredConstructionMaterials = computed(() => {
    const query = unref(constructionSearch).trim().toLocaleLowerCase()
    return unref(allConstructionMaterials).filter(material => {
      const matchesCategory = unref(constructionCategory) === '全部' || material.energyType === unref(constructionCategory)
      const matchesName = !query || material.machineryName.toLocaleLowerCase().includes(query)
      return matchesCategory && matchesName
    })
  })

  const filteredTransportMaterials = computed(() => {
    const query = unref(transportSearch).trim().toLocaleLowerCase()
    return unref(allTransportMaterials).filter(material => {
      const matchesCategory = unref(transportCategory) === '全部' || material.energyType === unref(transportCategory)
      const matchesName = !query ||
        material.vehicleName.toLocaleLowerCase().includes(query) ||
        material.transportedMaterial.toLocaleLowerCase().includes(query)
      return matchesCategory && matchesName
    })
  })

  return {
    recyclingQuantityGroups,
    filteredMaterials,
    filteredRecyclingMaterials,
    filteredConstructionMaterials,
    filteredTransportMaterials,
  }
}
