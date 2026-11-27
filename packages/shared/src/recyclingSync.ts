import { mapRecyclingCategory, recyclingReduction, recyclingResidualValue } from './calc'
import type { RecyclingRecord } from './models'

/** 回收联动同步所需的建材字段（旧版 BuildMaterialInfo 相关子集） */
export interface BuildMaterialLike {
  id: number
  materialName: string
  type: string
  unit: string
  quantity: number
  recyclingFactor: number
  recyclingCoefficient: number
}

/**
 * 回收记录自动联动（端口旧版 App.vue syncRecyclingMaterialWithBuildMaterial 的全量重算版）：
 * - 建材回收因子 > 0 → 自动创建/更新 sourceBuildMaterialId 关联记录，回收量收缩为 min(现值, 建材用量)；
 * - 建材回收因子归零 → 移除关联记录；
 * - 自定义回收记录（isCustomMaterial=true）不受影响；
 * - 返回新数组与是否有变化；不修改入参。
 */
export function syncRecyclingRecords(
  buildMaterials: BuildMaterialLike[],
  recyclingRecords: RecyclingRecord[],
): { list: RecyclingRecord[]; changed: boolean } {
  const nextIdBase = recyclingRecords.reduce((max, record) => Math.max(max, record.id), 0) + 1
  let nextId = nextIdBase
  const result: RecyclingRecord[] = []
  let changed = false

  const remainingCustom = recyclingRecords.filter(record => record.isCustomMaterial)
  const autoRecords = new Map<number, RecyclingRecord>()
  for (const record of recyclingRecords) {
    if (!record.isCustomMaterial && record.sourceBuildMaterialId != null) {
      autoRecords.set(record.sourceBuildMaterialId, record)
    }
  }

  for (const material of buildMaterials) {
    if (material.recyclingFactor <= 0) continue
    const existing = autoRecords.get(material.id)
    const recyclingQuantity = existing
      ? Math.min(existing.recyclingQuantity, material.quantity)
      : material.quantity
    const base = existing ?? null
    const updated: RecyclingRecord = {
      id: base ? base.id : nextId++,
      materialName: material.materialName,
      materialType: mapRecyclingCategory(material.type),
      recyclingQuantity,
      unit: material.unit,
      recyclingFactor: material.recyclingFactor,
      recyclingCoefficient: material.recyclingCoefficient,
      recyclingUnitPrice: base ? base.recyclingUnitPrice : 0,
      sourceBuildMaterialId: material.id,
      isCustomMaterial: false,
      reductionAmount: recyclingReduction(recyclingQuantity, material.recyclingFactor, material.recyclingCoefficient),
      residualValue: recyclingResidualValue(recyclingQuantity, base ? base.recyclingUnitPrice : 0),
    }
    if (!base) changed = true
    result.push(updated)
    autoRecords.delete(material.id)
  }

  // 剩余的自动关联记录：其来源建材已删除或回收因子归零 → 移除
  if (autoRecords.size > 0) changed = true

  const customChanged = !sameCustomRecords(remainingCustom, recyclingRecords)
  const list = [...result, ...remainingCustom]
  return { list, changed: changed || customChanged }
}

/** 删除建材时的回收清理（旧版 removeRecyclingMaterialForBuildMaterial）：
 * 移除 sourceBuildMaterialId 关联的记录；同时移除“无来源且同名”的非自定义记录（导入记录场景）。 */
export function removeRecyclingForDeletedBuildMaterial(
  recyclingRecords: RecyclingRecord[],
  deletedMaterial: { id: number; materialName: string },
): RecyclingRecord[] {
  return recyclingRecords.filter(record => {
    if (record.isCustomMaterial) return true
    if (record.sourceBuildMaterialId === deletedMaterial.id) return false
    if (record.sourceBuildMaterialId == null && record.materialName === deletedMaterial.materialName) {
      return false
    }
    return true
  })
}

function sameCustomRecords(a: RecyclingRecord[], b: RecyclingRecord[]): boolean {
  if (a.length === b.length) {
    const ids = new Set(a.map(record => record.id))
    return b.every(record => ids.has(record.id))
  }
  return false
}
