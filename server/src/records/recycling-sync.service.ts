import { Injectable } from '@nestjs/common'
import {
  mapRecyclingCategory,
  recyclingReduction,
  recyclingResidualValue,
} from '@carbonledger/shared'
import { PrismaService } from '../prisma/prisma.service'

/**
 * 建材与回收记录的增量同步服务。
 * 仅处理传入的建材，保留自定义回收记录和已有自动记录的单价。
 */
@Injectable()
export class RecyclingSyncService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 只同步本次变更的建材（客户界面行为），保留用户对其他回收记录的删除：
   * - 回收因子 > 0 的建材 → 创建/更新关联记录，回收量 min(现值, 建材用量)；
   * - 回收因子归零或建材删除 → 移除关联记录；
   * - 自定义回收记录保持不变。
   */
  async syncRecycling(projectId: number, materialIds: number[]): Promise<void> {
    if (materialIds.length === 0) return
    const buildMaterials = await this.prisma.buildMaterial.findMany({
      where: { projectId, id: { in: materialIds } },
    })
    const recycling = await this.prisma.recyclingRecord.findMany({
      where: { projectId, sourceBuildMaterialId: { in: materialIds } },
    })

    const existingBySource = new Map<number, { id: number; quantity: number; unitPrice: number }>()
    for (const record of recycling) {
      if (!record.isCustomMaterial && record.sourceBuildMaterialId != null) {
        existingBySource.set(record.sourceBuildMaterialId, {
          id: record.id,
          quantity: record.recyclingQuantity,
          unitPrice: record.recyclingUnitPrice,
        })
      }
    }

    const keepIds = new Set<number>()
    for (const material of buildMaterials) {
      if (material.recyclingFactor <= 0) continue
      const existing = existingBySource.get(material.id)
      const quantity = existing ? Math.min(existing.quantity, material.quantity) : material.quantity
      const unitPrice = existing ? existing.unitPrice : 0
      const category = mapRecyclingCategory(material.type)
      const reductionAmount = recyclingReduction(
        quantity,
        material.recyclingFactor,
        material.recyclingCoefficient,
      )
      const residualValue = recyclingResidualValue(quantity, unitPrice)

      if (existing) {
        keepIds.add(existing.id)
        await this.prisma.recyclingRecord.update({
          where: { id: existing.id },
          data: {
            materialName: material.materialName,
            materialType: category,
            recyclingQuantity: quantity,
            unit: material.unit,
            recyclingFactor: material.recyclingFactor,
            recyclingCoefficient: material.recyclingCoefficient,
            recyclingUnitPrice: unitPrice,
            reductionAmount,
            residualValue,
          },
        })
      } else {
        const created = await this.prisma.recyclingRecord.create({
          data: {
            projectId,
            materialName: material.materialName,
            materialType: category,
            recyclingQuantity: quantity,
            unit: material.unit,
            recyclingFactor: material.recyclingFactor,
            recyclingCoefficient: material.recyclingCoefficient,
            recyclingUnitPrice: unitPrice,
            sourceBuildMaterialId: material.id,
            isCustomMaterial: false,
            reductionAmount,
            residualValue,
          },
        })
        keepIds.add(created.id)
      }
    }

    // 删除不再需要的自动联动记录
    const staleIds = [...existingBySource.values()]
      .map(record => record.id)
      .filter(id => !keepIds.has(id))
    if (staleIds.length > 0) {
      await this.prisma.recyclingRecord.deleteMany({ where: { id: { in: staleIds } } })
    }
  }
}
