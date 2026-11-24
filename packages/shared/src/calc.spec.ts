import { describe, expect, it } from 'vitest'
import {
  applyTransportFactorConfig,
  buildEmission,
  buildTotalPrice,
  computeBuildSummary,
  computeConstructionSummary,
  computeCostAnalysis,
  computeEmissionAnalysis,
  computeLifecycleStages,
  computeRecyclingSummary,
  computeTransportSummary,
  constructionEmission,
  constructionTotalEnergy,
  constructionTotalPrice,
  defaultUnitForCategory,
  mapRecyclingCategory,
  recalcBuildMaterial,
  recalcConstructionRecord,
  recalcRecyclingRecord,
  recalcTransportRecord,
  recyclingReduction,
  recyclingResidualValue,
  removeRecyclingForDeletedBuildMaterial,
  syncRecyclingRecords,
  transportEmission,
  transportTotalPrice,
  withTransportStage,
} from '../src'
import type {
  BuildMaterialRecord,
  ConstructionRecord,
  RecyclingRecord,
  TransportRecord,
} from '../src/models'

// ---------- 单条公式 ----------

describe('建材公式（旧版口径）', () => {
  it('排放量 = 用量 × 因子 ÷ 1000', () => {
    expect(buildEmission(100, 2.5)).toBeCloseTo(0.25)
  })

  it('总价 = 用量 × 成交价 ÷ 10000', () => {
    expect(buildTotalPrice(100, 300)).toBeCloseTo(3)
  })

  it('回收因子 > 0 才参与回收计算', () => {
    expect(buildTotalPrice(0, 300)).toBe(0)
  })
})

describe('运输公式（旧版口径）', () => {
  it('排放量 = 运距 × 运输量 × 因子 ÷ 1000', () => {
    expect(transportEmission(50, 10, 0.05)).toBeCloseTo(0.25)
  })

  it('总价 = 运距 × 运输单价 ÷ 10000（旧版原式，不乘运输量）', () => {
    expect(transportTotalPrice(50, 0.8)).toBeCloseTo(0.004)
  })
})

describe('施工公式（旧版口径）', () => {
  it('能源总耗 = 台班数 × 单位台班能耗', () => {
    expect(constructionTotalEnergy(10, 100)).toBe(1000)
  })

  it('排放量 kg = 能源总耗 × 因子', () => {
    expect(constructionEmission(1000, 0.581)).toBeCloseTo(581)
  })

  it('总价 = 台班数 × 台班单价 ÷ 10000', () => {
    expect(constructionTotalPrice(10, 500)).toBeCloseTo(0.5)
  })
})

describe('回收公式（旧版口径）', () => {
  it('减碳量 = 回收量 × 因子 × 系数 ÷ 1000', () => {
    expect(recyclingReduction(100, 0.5, 0.8)).toBeCloseTo(0.04)
  })

  it('残值 = 回收量 × 单价 ÷ 10000', () => {
    expect(recyclingResidualValue(100, 50)).toBeCloseTo(0.5)
  })

  it('类别映射：金属/保温材料/玻璃沿用，其余为其他', () => {
    expect(mapRecyclingCategory('金属')).toBe('金属')
    expect(mapRecyclingCategory('保温材料')).toBe('保温材料')
    expect(mapRecyclingCategory('玻璃')).toBe('玻璃')
    expect(mapRecyclingCategory('混凝土')).toBe('其他')
  })
})

// ---------- 记录重算 ----------

describe('记录重算（派生字段）', () => {
  it('建材记录重算', () => {
    const base = {
      id: 1,
      materialName: '钢材',
      type: '金属',
      quantity: 100,
      unit: 't',
      emissionFactor: 2.5,
      marketPrice: null,
      unitPrice: 300,
      recyclingFactor: 0.9,
      recyclingCoefficient: 0.8,
      isCustomMaterial: true,
      emissionAmount: 0,
      totalPrice: 0,
      isParticipatingInRecyclingCalculation: false,
    }
    const record = recalcBuildMaterial(base as BuildMaterialRecord)
    expect(record.emissionAmount).toBeCloseTo(0.25)
    expect(record.totalPrice).toBeCloseTo(3)
    expect(record.isParticipatingInRecyclingCalculation).toBe(true)
  })

  it('运输记录重算', () => {
    const record = recalcTransportRecord({
      id: 1,
      vehicleName: '柴油货车',
      transportedMaterial: '钢材',
      transportQuantity: 10,
      transportDistance: 50,
      energyType: '柴油',
      emissionFactor: 0.05,
      transportUnitPrice: 0.8,
      isCustomMaterial: false,
      emissionAmount: 0,
      transportTotalPrice: 0,
    })
    expect(record.emissionAmount).toBeCloseTo(0.25)
    expect(record.transportTotalPrice).toBeCloseTo(0.004)
  })

  it('施工记录重算（排放 kg）', () => {
    const record = recalcConstructionRecord({
      id: 1,
      machineryName: '塔吊',
      shiftCount: 10,
      energyType: '电力',
      energyPerShift: 100,
      emissionFactor: 0.581,
      shiftUnitPrice: 500,
      isCustomMaterial: true,
      energyUnit: 'kWh',
      totalEnergy: 0,
      emissionAmount: 0,
      totalPrice: 0,
    })
    expect(record.totalEnergy).toBe(1000)
    expect(record.emissionAmount).toBeCloseTo(581)
    expect(record.totalPrice).toBeCloseTo(0.5)
  })

  it('回收记录重算', () => {
    const record = recalcRecyclingRecord({
      id: 1,
      materialName: '钢材',
      materialType: '金属',
      recyclingQuantity: 100,
      unit: 't',
      recyclingFactor: 0.5,
      recyclingCoefficient: 0.8,
      recyclingUnitPrice: 50,
      sourceBuildMaterialId: null,
      isCustomMaterial: false,
      reductionAmount: 0,
      residualValue: 0,
    })
    expect(record.reductionAmount).toBeCloseTo(0.04)
    expect(record.residualValue).toBeCloseTo(0.5)
  })
})

// ---------- 汇总 ----------

describe('阶段汇总', () => {
  it('建材汇总：单位面积排放分母为面积，面积为 0 时为 0', () => {
    const summary = computeBuildSummary(
      [
        { emissionAmount: 0.25, totalPrice: 3 },
        { emissionAmount: 0.75, totalPrice: 1 },
      ],
      100,
    )
    expect(summary.totalEmission).toBeCloseTo(1)
    expect(summary.totalMaterialCost).toBeCloseTo(4)
    expect(summary.emissionPerArea).toBeCloseTo(10)
    expect(computeBuildSummary([{ emissionAmount: 1, totalPrice: 1 }], 0).emissionPerArea).toBe(0)
  })

  it('运输汇总：按柴油/汽油分项与占比', () => {
    const summary = computeTransportSummary([
      { energyType: '柴油', emissionAmount: 0.25 },
      { energyType: '汽油', emissionAmount: 0.75 },
    ] as TransportRecord[])
    expect(summary.totalEmission).toBeCloseTo(1)
    expect(summary.energyTotals['柴油'].share).toBeCloseTo(25)
    expect(summary.energyTotals['汽油'].share).toBeCloseTo(75)
  })

  it('施工汇总：仅统计机械名称非空的记录；能源因子均值', () => {
    const records = [
      { machineryName: '塔吊', shiftCount: 10, energyType: '电力', totalEnergy: 1000, emissionAmount: 581, totalPrice: 0.5 },
      { machineryName: '', shiftCount: 5, energyType: '柴油', totalEnergy: 100, emissionAmount: 263.2, totalPrice: 0.2 },
    ] as ConstructionRecord[]
    const summary = computeConstructionSummary(records)
    expect(summary.totalShiftCount).toBe(10)
    expect(summary.totalEmission).toBeCloseTo(581)
    expect(summary.energyTotals['电力'].emissionFactor).toBeCloseTo(0.581)
    expect(summary.energyTotals['柴油'].energyTotal).toBe(0)
  })

  it('回收汇总：利用率分母为建材总排放，为零时安全处理', () => {
    const records = [
      { recyclingQuantity: 100, recyclingFactor: 0.5, recyclingCoefficient: 0.8, residualValue: 0.5 },
    ] as RecyclingRecord[]
    const summary = computeRecyclingSummary(records, 1)
    expect(summary.totalReduction).toBeCloseTo(0.04)
    expect(summary.totalRecyclingQuantity).toBe(100)
    expect(summary.recyclingUtilizationRate).toBeCloseTo(4)
    expect(summary.estimatedResidualValue).toBeCloseTo(0.5)
    expect(computeRecyclingSummary(records, 0).recyclingUtilizationRate).toBe(0)
  })
})

// ---------- 分析 ----------

describe('排放与成本分析', () => {
  const materials = [
    { id: 1, materialName: 'A', type: '金属', emissionAmount: 0.25, totalPrice: 3 },
    { id: 2, materialName: 'B', type: '其他', emissionAmount: 0.75, totalPrice: 1 },
  ] as BuildMaterialRecord[]
  const construction = [
    { machineryName: '塔吊', shiftCount: 10, energyType: '电力', totalEnergy: 1000, emissionAmount: 581, totalPrice: 0.5 },
  ] as ConstructionRecord[]
  const transport = [
    { transportTotalPrice: 0.004 },
  ] as TransportRecord[]

  it('生命周期阶段：施工 kg→t，回收为负值', () => {
    const stages = computeLifecycleStages(1, 0.5, 581, 0.04)
    expect(stages).toEqual([
      { name: '建材碳排放', emission: 1 },
      { name: '运输碳排放', emission: 0.5 },
      { name: '施工碳排放', emission: 0.581 },
      { name: '回收碳计算', emission: -0.04 },
    ])
    expect(withTransportStage(stages, 0.5)[1].emission).toBeCloseTo(0.5)
  })

  it('排放分析：净排放与单位面积净排放', () => {
    const buildSummary = computeBuildSummary(materials, 100)
    const constructionSummary = computeConstructionSummary(construction)
    const recyclingSummary = computeRecyclingSummary([], 0)
    const analysis = computeEmissionAnalysis(
      materials,
      construction,
      buildSummary,
      constructionSummary,
      recyclingSummary,
      100,
    )
    // 净排放 = 0.25 + 0.75(建材) + 0(运输) + 0.581(施工) - 0(回收) = 1.581
    expect(analysis.netEmission).toBeCloseTo(1.581)
    expect(analysis.unitAreaNetEmission).toBeCloseTo(15.81)
    expect(analysis.buildMaterialDetails[0].materialName).toBe('B')
    expect(analysis.buildMaterialDetails[0].rank).toBe(1)
    expect(analysis.buildMaterialDetails[0].share).toBeCloseTo(75)
  })

  it('成本分析：总成本、单位面积成本、单位成本碳排放、成本碳强度', () => {
    const cost = computeCostAnalysis(materials, transport, construction, 1.581, 100)
    expect(cost.buildCost).toBeCloseTo(4)
    expect(cost.totalCost).toBeCloseTo(4.504)
    expect(cost.topBuildMaterial?.materialName).toBe('A')
    expect(cost.unitAreaCost).toBeCloseTo(0.04504)
    expect(cost.unitCostEmission).toBeCloseTo(1.581 / 4.504)
    expect(cost.buildDetails[0].carbonCostIntensity).toBeCloseTo(
      (0.25 * 1000) / (3 * 10000),
    )
    // 面积为 0 时单位面积成本安全处理
    expect(computeCostAnalysis(materials, transport, construction, 1, 0).unitAreaCost).toBe(0)
  })
})

// ---------- 回收联动 ----------

describe('回收自动联动（旧版行为）', () => {
  const build = {
    id: 1,
    materialName: '钢材',
    type: '金属',
    unit: 't',
    quantity: 100,
    recyclingFactor: 0.9,
    recyclingCoefficient: 0.8,
  }

  it('建材回收因子 > 0 → 自动创建回收记录，初始回收量 = 建材用量', () => {
    const { list, changed } = syncRecyclingRecords([build], [])
    expect(changed).toBe(true)
    expect(list).toHaveLength(1)
    expect(list[0].sourceBuildMaterialId).toBe(1)
    expect(list[0].recyclingQuantity).toBe(100)
    expect(list[0].materialType).toBe('金属')
    expect(list[0].reductionAmount).toBeCloseTo((100 * 0.9 * 0.8) / 1000)
  })

  it('建材用量改小 → 回收量收缩为 min(现回收量, 建材用量)', () => {
    const existing: RecyclingRecord = {
      id: 10,
      materialName: '钢材',
      materialType: '金属',
      recyclingQuantity: 80,
      unit: 't',
      recyclingFactor: 0.9,
      recyclingCoefficient: 0.8,
      recyclingUnitPrice: 50,
      sourceBuildMaterialId: 1,
      isCustomMaterial: false,
      reductionAmount: 0,
      residualValue: 0,
    }
    const { list } = syncRecyclingRecords([{ ...build, quantity: 50 }], [existing])
    expect(list).toHaveLength(1)
    expect(list[0].recyclingQuantity).toBe(50)
    expect(list[0].recyclingUnitPrice).toBe(50)
    expect(list[0].id).toBe(10)
  })

  it('建材回收因子归零 → 移除关联记录；自定义记录保留', () => {
    const autoRecord: RecyclingRecord = {
      id: 10,
      materialName: '钢材',
      materialType: '金属',
      recyclingQuantity: 50,
      unit: 't',
      recyclingFactor: 0.9,
      recyclingCoefficient: 0.8,
      recyclingUnitPrice: 0,
      sourceBuildMaterialId: 1,
      isCustomMaterial: false,
      reductionAmount: 0,
      residualValue: 0,
    }
    const customRecord: RecyclingRecord = {
      ...autoRecord,
      id: 11,
      sourceBuildMaterialId: null,
      isCustomMaterial: true,
      materialName: '自定义回收',
    }
    const { list } = syncRecyclingRecords([{ ...build, recyclingFactor: 0 }], [autoRecord, customRecord])
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe(11)
  })

  it('删除建材 → 移除关联记录及同名无来源的非自定义记录', () => {
    const records: RecyclingRecord[] = [
      { id: 1, materialName: '钢材', materialType: '金属', recyclingQuantity: 1, unit: 't', recyclingFactor: 1, recyclingCoefficient: 1, recyclingUnitPrice: 0, sourceBuildMaterialId: 1, isCustomMaterial: false, reductionAmount: 0, residualValue: 0 },
      { id: 2, materialName: '钢材', materialType: '金属', recyclingQuantity: 1, unit: 't', recyclingFactor: 1, recyclingCoefficient: 1, recyclingUnitPrice: 0, sourceBuildMaterialId: null, isCustomMaterial: false, reductionAmount: 0, residualValue: 0 },
      { id: 3, materialName: '钢材', materialType: '金属', recyclingQuantity: 1, unit: 't', recyclingFactor: 1, recyclingCoefficient: 1, recyclingUnitPrice: 0, sourceBuildMaterialId: null, isCustomMaterial: true, reductionAmount: 0, residualValue: 0 },
      { id: 4, materialName: '玻璃', materialType: '玻璃', recyclingQuantity: 1, unit: 'm²', recyclingFactor: 1, recyclingCoefficient: 1, recyclingUnitPrice: 0, sourceBuildMaterialId: 2, isCustomMaterial: false, reductionAmount: 0, residualValue: 0 },
    ]
    const next = removeRecyclingForDeletedBuildMaterial(records, { id: 1, materialName: '钢材' })
    expect(next.map(record => record.id)).toEqual([3, 4])
  })

  it('运输配置联动：选车即联动能源类型与因子', () => {
    const record = recalcTransportRecord({
      id: 1,
      vehicleName: '临时',
      transportedMaterial: '货物',
      transportQuantity: 10,
      transportDistance: 100,
      energyType: '柴油',
      emissionFactor: 1,
      transportUnitPrice: 1,
      isCustomMaterial: false,
      emissionAmount: 0,
      transportTotalPrice: 0,
    })
    const updated = applyTransportFactorConfig(record, {
      id: 5,
      vehicleName: '汽油货车',
      energyType: '汽油',
      emissionFactor: 0.2,
    })
    expect(updated.vehicleName).toBe('汽油货车')
    expect(updated.energyType).toBe('汽油')
    expect(updated.emissionFactor).toBe(0.2)
    expect(updated.emissionAmount).toBeCloseTo((100 * 10 * 0.2) / 1000)
  })

  it('建材导入类别默认单位', () => {
    expect(defaultUnitForCategory('金属')).toBe('t')
    expect(defaultUnitForCategory('未知类别')).toBe('')
  })
})
