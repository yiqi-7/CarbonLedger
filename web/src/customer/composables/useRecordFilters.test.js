import { ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { useRecordFilters } from './useRecordFilters.js'

function createFilters(overrides = {}) {
  const inputs = {
    allMaterials: ref([
      { id: 1, type: '混凝土', materialName: 'C30 混凝土' },
      { id: 2, type: '金属', materialName: '钢筋' },
    ]),
    allRecyclingMaterials: ref([
      { id: 3, materialType: '金属', materialName: '钢筋', unit: '吨', recyclingQuantity: 2 },
      { id: 4, materialType: '玻璃', materialName: '玻璃', unit: ' kg ', recyclingQuantity: 3 },
    ]),
    allConstructionMaterials: ref([
      { id: 5, energyType: '电力', machineryName: '塔吊作业' },
      { id: 6, energyType: '柴油', machineryName: '挖掘机' },
    ]),
    allTransportMaterials: ref([
      { id: 7, energyType: '柴油', vehicleName: '重型卡车', transportedMaterial: '钢筋' },
      { id: 8, energyType: '电力', vehicleName: '电动货车', transportedMaterial: '玻璃' },
    ]),
    materialCategory: ref('全部'),
    materialSearch: ref(''),
    recyclingCategory: ref('全部回收'),
    recyclingSearch: ref(''),
    constructionCategory: ref('全部'),
    constructionSearch: ref(''),
    transportCategory: ref('全部'),
    transportSearch: ref(''),
    ...overrides,
  }
  return { inputs, filters: useRecordFilters(inputs) }
}

describe('useRecordFilters', () => {
  it('groups recycling quantities by canonical unit aliases and preserves first-seen order', () => {
    const { inputs, filters } = createFilters({
      allRecyclingMaterials: ref([
        { unit: '㎡', recyclingQuantity: 1 },
        { unit: 'm2', recyclingQuantity: 2 },
        { unit: 'm^2', recyclingQuantity: 3 },
        { unit: '平方米', recyclingQuantity: 4 },
        { unit: '㎥', recyclingQuantity: 5 },
        { unit: 'm3', recyclingQuantity: 6 },
        { unit: 'm^3', recyclingQuantity: 7 },
        { unit: '立方米', recyclingQuantity: 8 },
        { unit: '吨', recyclingQuantity: 9 },
        { unit: '千克', recyclingQuantity: 10 },
        { unit: '公斤', recyclingQuantity: 11 },
        { unit: '  ', recyclingQuantity: 12 },
      ]),
    })
    expect(filters.recyclingQuantityGroups.value).toEqual([
      { unit: 'm²', quantity: 10 },
      { unit: 'm³', quantity: 26 },
      { unit: 't', quantity: 9 },
      { unit: 'kg', quantity: 21 },
      { unit: '未标注单位', quantity: 12 },
    ])
    inputs.allRecyclingMaterials.value.push({ unit: '吨', recyclingQuantity: 1 })
    expect(filters.recyclingQuantityGroups.value[2]).toEqual({ unit: 't', quantity: 10 })
  })

  it('filters building materials by category and exact case-insensitive trimmed name', () => {
    const { inputs, filters } = createFilters()
    inputs.materialCategory.value = '金属'
    inputs.materialSearch.value = '  钢筋  '
    expect(filters.filteredMaterials.value.map(row => row.id)).toEqual([2])
    inputs.materialSearch.value = '筋'
    expect(filters.filteredMaterials.value).toEqual([])
  })

  it('filters recycling materials by category and exact case-insensitive trimmed name', () => {
    const { inputs, filters } = createFilters()
    inputs.recyclingCategory.value = '金属'
    inputs.recyclingSearch.value = '  钢筋 '
    expect(filters.filteredRecyclingMaterials.value.map(row => row.id)).toEqual([3])
    inputs.recyclingSearch.value = '钢'
    expect(filters.filteredRecyclingMaterials.value).toEqual([])
  })

  it('filters construction materials by category and case-insensitive name includes', () => {
    const { inputs, filters } = createFilters()
    inputs.constructionCategory.value = '电力'
    inputs.constructionSearch.value = '  吊作业 '
    expect(filters.filteredConstructionMaterials.value.map(row => row.id)).toEqual([5])
    inputs.constructionSearch.value = '不存在'
    expect(filters.filteredConstructionMaterials.value).toEqual([])
  })

  it('filters transport materials by category and matches vehicle or transported material includes', () => {
    const { inputs, filters } = createFilters()
    inputs.transportCategory.value = '柴油'
    inputs.transportSearch.value = '  钢筋 '
    expect(filters.filteredTransportMaterials.value.map(row => row.id)).toEqual([7])
    inputs.transportCategory.value = '全部'
    inputs.transportSearch.value = '货车'
    expect(filters.filteredTransportMaterials.value.map(row => row.id)).toEqual([8])
  })
})
