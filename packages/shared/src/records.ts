import { BUILD_MATERIAL_DEFAULT_UNITS } from './constants'
import { isRecyclingParticipant } from './calc'
import type {
  BuildFactorConfig,
  BuildMaterialRecord,
  ConstructionRecord,
  RecyclingRecord,
  TransportFactorConfig,
  TransportRecord,
} from './models'

/**
 * 从项目级建材因子配置创建建材记录（对应旧版“选配置新增建材”两步流程的服务端语义）：
 * 名称必须命中配置，类别/单位/因子/回收参数由配置带入。
 */
export function createBuildMaterialFromConfig(
  config: BuildFactorConfig,
  input: { quantity: number; marketPrice: number | null; unitPrice: number; id: number },
): BuildMaterialRecord {
  const record: BuildMaterialRecord = {
    id: input.id,
    materialName: config.name,
    type: config.category,
    quantity: input.quantity,
    unit: config.materialUnit,
    emissionFactor: config.emissionFactor,
    marketPrice: input.marketPrice,
    unitPrice: input.unitPrice,
    recyclingFactor: config.recyclingFactor,
    recyclingCoefficient: config.recyclingCoefficient,
    isCustomMaterial: true,
    emissionAmount: 0,
    totalPrice: 0,
    isParticipatingInRecyclingCalculation: isRecyclingParticipant(config.recyclingFactor),
  }
  return recalcBuildMaterial(record)
}

/** 依据配置重刷建材的回收参数（旧版 applyBuildCarbonConfiguration） */
export function applyBuildFactorConfig(
  material: BuildMaterialRecord,
  config: BuildFactorConfig | null,
  applyEmissionProperties: boolean,
): BuildMaterialRecord {
  if (!config) return material
  const updates: Partial<BuildMaterialRecord> = {
    recyclingFactor: config.recyclingFactor,
    recyclingCoefficient: config.recyclingCoefficient,
    isParticipatingInRecyclingCalculation: isRecyclingParticipant(config.recyclingFactor),
  }
  if (applyEmissionProperties) {
    updates.type = config.category
    updates.unit = config.materialUnit
    updates.emissionFactor = config.emissionFactor
  }
  return recalcBuildMaterial({ ...material, ...updates })
}

/** 重算建材派生字段（旧版 BuildMaterialInfo 构造/update 语义） */
export function recalcBuildMaterial(material: BuildMaterialRecord): BuildMaterialRecord {
  return {
    ...material,
    emissionAmount: (material.quantity * material.emissionFactor) / 1000,
    totalPrice: (material.quantity * material.unitPrice) / 10000,
    isParticipatingInRecyclingCalculation: isRecyclingParticipant(material.recyclingFactor),
  }
}

/** 重算运输记录派生字段（旧版 TransportMaterialInfo 语义；总价公式沿用旧版） */
export function recalcTransportRecord(record: TransportRecord): TransportRecord {
  return {
    ...record,
    emissionAmount:
      (record.transportDistance * record.transportQuantity * record.emissionFactor) / 1000,
    transportTotalPrice: (record.transportDistance * record.transportUnitPrice) / 10000,
  }
}

/** 重算施工记录派生字段（旧版 ConstructionMaterialInfo 语义；排放 kg） */
export function recalcConstructionRecord(record: ConstructionRecord): ConstructionRecord {
  const totalEnergy = record.shiftCount * record.energyPerShift
  return {
    ...record,
    totalEnergy,
    emissionAmount: totalEnergy * record.emissionFactor,
    totalPrice: (record.shiftCount * record.shiftUnitPrice) / 10000,
  }
}

/** 重算回收记录派生字段（旧版 RecyclingMateiralInfo 语义） */
export function recalcRecyclingRecord(record: RecyclingRecord): RecyclingRecord {
  return {
    ...record,
    reductionAmount:
      (record.recyclingQuantity * record.recyclingFactor * record.recyclingCoefficient) / 1000,
    residualValue: (record.recyclingQuantity * record.recyclingUnitPrice) / 10000,
  }
}

/** 运输记录能源类型/因子由配置联动（旧版：选车即联动，均不可编辑） */
export function applyTransportFactorConfig(
  record: TransportRecord,
  config: TransportFactorConfig | null,
): TransportRecord {
  if (!config) return record
  return recalcTransportRecord({
    ...record,
    vehicleName: config.vehicleName,
    energyType: config.energyType,
    emissionFactor: config.emissionFactor,
  })
}

/** 建材导入的类别默认单位（旧版 defaultUnits；未知类别为空字符串） */
export function defaultUnitForCategory(category: string): string {
  return BUILD_MATERIAL_DEFAULT_UNITS[category] ?? ''
}
