import { CONSTRUCTION_ENERGY_TYPES, RECYCLING_PRESERVED_CATEGORIES, TRANSPORT_ENERGY_TYPES } from './constants'
import type {
  BuildCarbonSummary,
  BuildMaterialRecord,
  ConstructionCarbonSummary,
  ConstructionRecord,
  CostAnalysis,
  EmissionAnalysis,
  LifecycleStage,
  RecyclingCarbonSummary,
  RecyclingCategory,
  RecyclingRecord,
  TransportCarbonSummary,
  TransportRecord,
} from './models'

/**
 * 核算引擎：公式与旧项目 ProjectCarbonCal 完全一致。
 * 所有函数均为纯函数；不修改入参。
 */

// ---------- 建材（建造生产阶段） ----------

/** 建材排放量（t）= 用量 × 碳排因子 ÷ 1000 */
export function buildEmission(quantity: number, emissionFactor: number): number {
  return (quantity * emissionFactor) / 1000
}

/** 建材总价（万元）= 用量 × 成交价（元）÷ 10000 */
export function buildTotalPrice(quantity: number, unitPrice: number): number {
  return (quantity * unitPrice) / 10000
}

/** 建材是否参与回收计算（旧版：回收因子 > 0） */
export function isRecyclingParticipant(recyclingFactor: number): boolean {
  return recyclingFactor > 0
}

// ---------- 运输（建造运输阶段） ----------

/** 运输排放量（t）= 运距 × 运输量 × 因子 ÷ 1000 */
export function transportEmission(
  transportDistance: number,
  transportQuantity: number,
  emissionFactor: number,
): number {
  return (transportDistance * transportQuantity * emissionFactor) / 1000
}

/**
 * 运输总价（万元）= 运距 × 运输单价 ÷ 10000
 * 注意：严格沿用旧版源码公式（未乘运输量）；单价口径以旧版数据为准。
 */
export function transportTotalPrice(transportDistance: number, transportUnitPrice: number): number {
  return (transportDistance * transportUnitPrice) / 10000
}

// ---------- 施工（施工建造阶段） ----------

/** 施工能源总耗 = 台班数 × 单位台班能耗 */
export function constructionTotalEnergy(shiftCount: number, energyPerShift: number): number {
  return shiftCount * energyPerShift
}

/** 施工排放量（kg）= 能源总耗 × 能源因子（展示 t 时 ÷1000） */
export function constructionEmission(totalEnergy: number, emissionFactor: number): number {
  return totalEnergy * emissionFactor
}

/** 施工总价（万元）= 台班数 × 台班单价（元）÷ 10000 */
export function constructionTotalPrice(shiftCount: number, shiftUnitPrice: number): number {
  return (shiftCount * shiftUnitPrice) / 10000
}

// ---------- 回收（减碳阶段） ----------

/** 回收减碳量（t）= 回收量 × 回收因子 × 回收系数 ÷ 1000 */
export function recyclingReduction(
  recyclingQuantity: number,
  recyclingFactor: number,
  recyclingCoefficient: number,
): number {
  return (recyclingQuantity * recyclingFactor * recyclingCoefficient) / 1000
}

/** 回收残值（万元）= 回收量 × 单价 ÷ 10000 */
export function recyclingResidualValue(recyclingQuantity: number, recyclingUnitPrice: number): number {
  return (recyclingQuantity * recyclingUnitPrice) / 10000
}

/** 自动联动记录的类别映射：金属/保温材料/玻璃沿用，其余为“其他” */
export function mapRecyclingCategory(buildType: string): RecyclingCategory {
  return (RECYCLING_PRESERVED_CATEGORIES as readonly string[]).includes(buildType)
    ? (buildType as RecyclingCategory)
    : '其他'
}

// ---------- 阶段汇总 ----------

/** 建材汇总（旧版 BuildCarbonInfo.update） */
export function computeBuildSummary(
  materials: Pick<BuildMaterialRecord, 'emissionAmount' | 'totalPrice'>[],
  buildingArea: number,
): BuildCarbonSummary {
  const totalEmission = materials.reduce((total, material) => total + material.emissionAmount, 0)
  const totalMaterialCost = materials.reduce((total, material) => total + material.totalPrice, 0)
  return {
    totalEmission,
    totalMaterialCost,
    emissionPerArea: buildingArea > 0 ? (totalEmission / buildingArea) * 1000 : 0,
  }
}

/** 运输汇总（旧版 TransportCarbonInfo.update） */
export function computeTransportSummary(
  records: Pick<TransportRecord, 'energyType' | 'emissionAmount'>[],
): TransportCarbonSummary {
  const totalEmission = records.reduce((total, record) => total + record.emissionAmount, 0)
  const energyTotals: TransportCarbonSummary['energyTotals'] = Object.fromEntries(
    TRANSPORT_ENERGY_TYPES.map(energyType => [energyType, { emissionAmount: 0, share: 0 }]),
  )
  for (const energyType of TRANSPORT_ENERGY_TYPES) {
    const emissionAmount = records
      .filter(record => record.energyType === energyType)
      .reduce((total, record) => total + record.emissionAmount, 0)
    energyTotals[energyType] = {
      emissionAmount,
      share: totalEmission > 0 ? (emissionAmount / totalEmission) * 100 : 0,
    }
  }
  return { totalEmission, energyTotals }
}

/** 施工记录是否计入统计（旧版：机械名称非空） */
export function isCountedConstructionRecord(
  record: Pick<ConstructionRecord, 'machineryName'>,
): boolean {
  return record.machineryName.trim().length > 0
}

/** 施工汇总（旧版 ConstructionCarbonInfo.update） */
export function computeConstructionSummary(
  records: ConstructionRecord[],
): ConstructionCarbonSummary {
  const counted = records.filter(isCountedConstructionRecord)
  const totalShiftCount = counted.reduce((total, record) => total + record.shiftCount, 0)
  const totalEmission = counted.reduce((total, record) => total + record.emissionAmount, 0)
  const energyTotals: ConstructionCarbonSummary['energyTotals'] = Object.fromEntries(
    (Object.entries(CONSTRUCTION_ENERGY_TYPES) as [ConstructionEnergyType, { unit: string; emissionFactor: number }][]).map(
      ([energyType, energy]) => [
        energyType,
        {
          energyTotal: 0,
          emissionAmount: 0,
          share: 0,
          unit: energy.unit,
          emissionFactor: energy.emissionFactor,
        },
      ],
    ),
  )
  for (const [energyType, energy] of Object.entries(CONSTRUCTION_ENERGY_TYPES) as [
    ConstructionEnergyType,
    { unit: string; emissionFactor: number },
  ][]) {
    const energyRecords = counted.filter(record => record.energyType === energyType)
    const energyTotal = energyRecords.reduce((total, record) => total + record.totalEnergy, 0)
    const emissionAmount = energyRecords.reduce((total, record) => total + record.emissionAmount, 0)
    energyTotals[energyType] = {
      energyTotal,
      emissionAmount,
      share: totalEmission > 0 ? (emissionAmount / totalEmission) * 100 : 0,
      unit: energy.unit,
      emissionFactor: energyTotal > 0 ? emissionAmount / energyTotal : energy.emissionFactor,
    }
  }
  return { totalEmission, totalShiftCount, energyTotals }
}

/** 回收汇总（旧版 RecyclingCarbonInfo.update） */
export function computeRecyclingSummary(
  records: RecyclingRecord[],
  totalBuildingEmission: number,
): RecyclingCarbonSummary {
  const totalReduction = records.reduce(
    (total, record) =>
      total +
      (record.recyclingQuantity * record.recyclingFactor * record.recyclingCoefficient) / 1000,
    0,
  )
  const totalRecyclingQuantity = records.reduce(
    (total, record) => total + record.recyclingQuantity,
    0,
  )
  const estimatedResidualValue = records.reduce((total, record) => total + record.residualValue, 0)
  return {
    totalReduction,
    totalRecyclingQuantity,
    recyclingUtilizationRate:
      totalBuildingEmission > 0 ? (totalReduction / totalBuildingEmission) * 100 : 0,
    estimatedResidualValue,
  }
}

// ---------- 排放与成本分析 ----------

/** 全生命周期阶段（旧版 analysisLifecycleStages；施工 kg→t，回收为负值） */
export function computeLifecycleStages(
  buildTotalEmission: number,
  transportTotalEmission: number,
  constructionTotalEmissionKg: number,
  recyclingTotalReduction: number,
): LifecycleStage[] {
  return [
    { name: '建材碳排放', emission: buildTotalEmission },
    { name: '运输碳排放', emission: transportTotalEmission },
    { name: '施工碳排放', emission: constructionTotalEmissionKg / 1000 },
    { name: '回收碳计算', emission: -recyclingTotalReduction },
  ]
}

/** 排放分析（旧版碳排放分析页口径） */
export function computeEmissionAnalysis(
  materials: BuildMaterialRecord[],
  constructionRecords: ConstructionRecord[],
  buildSummary: BuildCarbonSummary,
  constructionSummary: ConstructionCarbonSummary,
  recyclingSummary: RecyclingCarbonSummary,
  buildingArea: number,
): EmissionAnalysis {
  const stages = computeLifecycleStages(
    buildSummary.totalEmission,
    0,
    constructionSummary.totalEmission,
    recyclingSummary.totalReduction,
  )
  // 运输阶段排放由调用侧填充（保持参数显式），这里按 stages 顺序修正第二项。
  const netEmission = stages.reduce((total, stage) => total + stage.emission, 0)
  const details = materials
    .map((material, index) => ({
      id: material.id,
      rank: index + 1,
      materialName: material.materialName,
      type: material.type,
      emissionAmount: material.emissionAmount,
      share: buildSummary.totalEmission > 0
        ? (material.emissionAmount / buildSummary.totalEmission) * 100
        : 0,
    }))
    .sort((left, right) => right.emissionAmount - left.emissionAmount)
    .map((detail, index) => ({ ...detail, rank: index + 1 }))
  return {
    stages,
    netEmission,
    unitAreaNetEmission: buildingArea > 0 ? (netEmission * 1000) / buildingArea : 0,
    buildMaterialDetails: details,
  }
}

/** 成本分析（旧版成本分析页口径） */
export function computeCostAnalysis(
  materials: BuildMaterialRecord[],
  transportRecords: TransportRecord[],
  constructionRecords: ConstructionRecord[],
  netEmission: number,
  buildingArea: number,
): CostAnalysis {
  const countedConstruction = constructionRecords.filter(isCountedConstructionRecord)
  const buildCost = materials.reduce((total, material) => total + material.totalPrice, 0)
  const transportCost = transportRecords.reduce(
    (total, record) => total + record.transportTotalPrice,
    0,
  )
  const constructionCost = countedConstruction.reduce(
    (total, record) => total + record.totalPrice,
    0,
  )
  const totalCost = buildCost + transportCost + constructionCost
  const topBuild = materials.reduce<BuildMaterialRecord | null>(
    (highest, material) =>
      !highest || material.totalPrice > highest.totalPrice ? material : highest,
    null,
  )
  return {
    totalCost,
    buildCost,
    topBuildMaterial: topBuild
      ? {
          id: topBuild.id,
          materialName: topBuild.materialName,
          totalPrice: topBuild.totalPrice,
          shareOfBuildCost: buildCost > 0 ? (topBuild.totalPrice / buildCost) * 100 : 0,
        }
      : null,
    unitAreaCost: buildingArea > 0 ? totalCost / buildingArea : 0,
    unitCostEmission: totalCost > 0 ? netEmission / totalCost : 0,
    buildDetails: materials
      .map(material => ({
        id: material.id,
        materialName: material.materialName,
        totalPrice: material.totalPrice,
        costShare: totalCost > 0 ? (material.totalPrice / totalCost) * 100 : 0,
        carbonCostIntensity:
          material.totalPrice > 0
            ? (material.emissionAmount * 1000) / (material.totalPrice * 10000)
            : null,
      }))
      .sort((left, right) => right.totalPrice - left.totalPrice),
  }
}

/** 计算运输阶段排放并填入生命周期阶段（辅助函数，保证口径集中） */
export function withTransportStage(stages: LifecycleStage[], transportTotalEmission: number): LifecycleStage[] {
  return stages.map(stage =>
    stage.name === '运输碳排放' ? { ...stage, emission: transportTotalEmission } : stage,
  )
}
