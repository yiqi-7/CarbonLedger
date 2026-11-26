import type { ConstructionEnergyType, RecyclingCategory, TransportEnergyType } from './types'

/** 项目信息（字段与旧版 ProjectInfo 一致） */
export interface ProjectInfo {
  projectName: string
  province: string
  cityDistrict: string
  address: string
  buildingArea: number
  floorCount: string
  buildingType: string
  structureType: string
  designLife: string
  modelImage: string | null
  modelImageName: string
  startDate: string
  plannedCompletionDate: string
  projectManager: string
  accountingStandard: string
  accountingStages: readonly string[]
}

/** 建材记录输入（含可编辑字段与配置带入字段） */
export interface BuildMaterialInput {
  materialName: string
  type: string
  quantity: number
  unit: string
  emissionFactor: number
  marketPrice: number | null
  unitPrice: number
  recyclingFactor: number
  recyclingCoefficient: number
  isCustomMaterial: boolean
}

/** 建材记录（含派生字段） */
export interface BuildMaterialRecord extends BuildMaterialInput {
  id: number
  emissionAmount: number
  totalPrice: number
  isParticipatingInRecyclingCalculation: boolean
}

/** 运输记录输入 */
export interface TransportRecordInput {
  vehicleName: string
  transportedMaterial: string
  transportQuantity: number
  transportDistance: number
  energyType: TransportEnergyType
  emissionFactor: number
  transportUnitPrice: number
  isCustomMaterial: boolean
}

/** 运输记录（含派生字段） */
export interface TransportRecord extends TransportRecordInput {
  id: number
  emissionAmount: number
  transportTotalPrice: number
}

/** 施工记录输入 */
export interface ConstructionRecordInput {
  machineryName: string
  shiftCount: number
  energyType: ConstructionEnergyType
  energyPerShift: number
  emissionFactor: number
  shiftUnitPrice: number
  isCustomMaterial: boolean
}

/** 施工记录（含派生字段；emissionAmount 单位 kg） */
export interface ConstructionRecord extends ConstructionRecordInput {
  id: number
  energyUnit: string
  totalEnergy: number
  emissionAmount: number
  totalPrice: number
}

/** 回收记录输入 */
export interface RecyclingRecordInput {
  materialName: string
  materialType: RecyclingCategory
  recyclingQuantity: number
  unit: string
  recyclingFactor: number
  recyclingCoefficient: number
  recyclingUnitPrice: number
  sourceBuildMaterialId: number | null
  isCustomMaterial: boolean
}

/** 回收记录（含派生字段） */
export interface RecyclingRecord extends RecyclingRecordInput {
  id: number
  reductionAmount: number
  residualValue: number
}

/** 项目级建材因子配置（对应旧“建筑碳排配置”行） */
export interface BuildFactorConfig {
  id: number
  category: string
  name: string
  emissionFactor: number
  materialUnit: string
  recyclingFactor: number
  recyclingCoefficient: number
}

/** 项目级运输因子配置（对应旧“运输碳排配置”行） */
export interface TransportFactorConfig {
  id: number
  vehicleName: string
  energyType: TransportEnergyType
  emissionFactor: number
}

/** 建材阶段汇总（旧版 BuildCarbonInfo） */
export interface BuildCarbonSummary {
  totalEmission: number
  totalMaterialCost: number
  emissionPerArea: number
}

/** 运输阶段汇总（旧版 TransportCarbonInfo） */
export interface TransportCarbonSummary {
  totalEmission: number
  energyTotals: Record<string, { emissionAmount: number; share: number }>
}

/** 施工阶段汇总（旧版 ConstructionCarbonInfo） */
export interface ConstructionCarbonSummary {
  totalEmission: number
  totalShiftCount: number
  energyTotals: Record<
    string,
    { energyTotal: number; emissionAmount: number; share: number; unit: string; emissionFactor: number }
  >
}

/** 回收阶段汇总（旧版 RecyclingCarbonInfo） */
export interface RecyclingCarbonSummary {
  totalReduction: number
  totalRecyclingQuantity: number
  recyclingUtilizationRate: number
  estimatedResidualValue: number
}

/** 全生命周期阶段项（回收为负值） */
export interface LifecycleStage {
  name: string
  emission: number
}

/** 排放分析（旧版碳排放分析页口径） */
export interface EmissionAnalysis {
  stages: LifecycleStage[]
  netEmission: number
  unitAreaNetEmission: number
  buildMaterialDetails: Array<{
    id: number
    rank: number
    materialName: string
    type: string
    emissionAmount: number
    share: number
    quantity: number
    unit: string
    emissionFactor: number
  }>
}

/** 成本分析（旧版成本分析页口径） */
export interface CostAnalysis {
  totalCost: number
  buildCost: number
  topBuildMaterial: { id: number; materialName: string; totalPrice: number; shareOfBuildCost: number } | null
  /** 单位面积建材成本（万元/㎡）= 建材成本 ÷ 建筑面积，旧版成本分析指标卡与报告书 I10 口径 */
  unitAreaBuildCost: number
  unitCostEmission: number
  buildDetails: Array<{
    id: number
    materialName: string
    totalPrice: number
    costShare: number
    carbonCostIntensity: number | null
  }>
}

/** 核算版本快照内容 */
export interface CalcVersionSnapshot {
  versionNumber: number
  name?: string
  savedAt: string
  savedByUserId: number
  project: ProjectInfo
  factors: {
    build: BuildFactorConfig[]
    transport: TransportFactorConfig[]
  }
  buildMaterials: BuildMaterialRecord[]
  transportRecords: TransportRecord[]
  constructionRecords: ConstructionRecord[]
  recyclingRecords: RecyclingRecord[]
  summary: {
    build: BuildCarbonSummary
    transport: TransportCarbonSummary
    construction: ConstructionCarbonSummary
    recycling: RecyclingCarbonSummary
    emission: EmissionAnalysis
    cost: CostAnalysis
  }
}
