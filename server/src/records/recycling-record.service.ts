import { Injectable, NotFoundException } from '@nestjs/common'
import { recyclingReduction, recyclingResidualValue } from '@carbonledger/shared'
import type { RecyclingRecord } from '@carbonledger/shared'
import { PrismaService } from '../prisma/prisma.service'
import { RecordAccessService } from './record-access.service'
import type { CreateRecyclingRecordDto, UpdateRecyclingRecordDto } from './records.dto'

/**
 * 回收记录的数据库与领域操作。
 *
 * 回收记录 CRUD 与建材联动同步保持独立：本服务只处理显式 CRUD，
 * 自动记录的增量同步由 RecyclingSyncService 负责。
 */
@Injectable()
export class RecyclingRecordService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: RecordAccessService,
  ) {}

  async listRecyclingRecords(projectId: number, userId: number): Promise<RecyclingRecord[]> {
    await this.access.assertOwner(projectId, userId)
    return this.prisma.recyclingRecord.findMany({
      where: { projectId },
      orderBy: { id: 'asc' },
    }) as unknown as RecyclingRecord[]
  }

  async createRecyclingRecord(
    projectId: number,
    userId: number,
    dto: CreateRecyclingRecordDto,
  ): Promise<RecyclingRecord> {
    await this.access.assertOwner(projectId, userId)
    const quantity = Number(dto.recyclingQuantity)
    const factor = Number(dto.recyclingFactor)
    const coefficient = Number(dto.recyclingCoefficient ?? 0)
    const unitPrice = Number(dto.recyclingUnitPrice ?? 0)
    const created = await this.prisma.recyclingRecord.create({
      data: {
        projectId,
        materialName: dto.materialName,
        materialType: dto.materialType,
        recyclingQuantity: quantity,
        unit: dto.unit ?? '',
        recyclingFactor: factor,
        recyclingCoefficient: coefficient,
        recyclingUnitPrice: unitPrice,
        sourceBuildMaterialId: null,
        isCustomMaterial: true,
        reductionAmount: recyclingReduction(quantity, factor, coefficient),
        residualValue: recyclingResidualValue(quantity, unitPrice),
      },
    })
    return created as unknown as RecyclingRecord
  }

  async updateRecyclingRecord(
    projectId: number,
    userId: number,
    recordId: number,
    dto: UpdateRecyclingRecordDto,
  ): Promise<RecyclingRecord> {
    await this.access.assertOwner(projectId, userId)
    const existing = await this.prisma.recyclingRecord.findFirst({
      where: { id: recordId, projectId },
    })
    if (!existing) throw new NotFoundException('回收记录不存在')

    // 自动联动记录：仅回收量与单价可改，回收量上限为来源建材用量（旧版截断行为）
    const isAuto = !existing.isCustomMaterial && existing.sourceBuildMaterialId != null
    let quantity =
      dto.recyclingQuantity == null ? existing.recyclingQuantity : Number(dto.recyclingQuantity)
    if (isAuto && existing.sourceBuildMaterialId != null) {
      const source = await this.prisma.buildMaterial.findUnique({
        where: { id: existing.sourceBuildMaterialId },
      })
      if (source && quantity > source.quantity) quantity = source.quantity
    }
    const factor =
      !isAuto && dto.recyclingFactor != null ? Number(dto.recyclingFactor) : existing.recyclingFactor
    const coefficient =
      !isAuto && dto.recyclingCoefficient != null
        ? Number(dto.recyclingCoefficient)
        : existing.recyclingCoefficient
    const unitPrice =
      dto.recyclingUnitPrice == null ? existing.recyclingUnitPrice : Number(dto.recyclingUnitPrice)
    const materialName = !isAuto ? (dto.materialName ?? existing.materialName) : existing.materialName
    const materialType = !isAuto
      ? (dto.materialType ?? existing.materialType)
      : existing.materialType

    const updated = await this.prisma.recyclingRecord.update({
      where: { id: recordId },
      data: {
        materialName,
        materialType,
        recyclingQuantity: quantity,
        recyclingFactor: factor,
        recyclingCoefficient: coefficient,
        recyclingUnitPrice: unitPrice,
        reductionAmount: recyclingReduction(quantity, factor, coefficient),
        residualValue: recyclingResidualValue(quantity, unitPrice),
      },
    })
    return updated as unknown as RecyclingRecord
  }

  async removeRecyclingRecord(
    projectId: number,
    userId: number,
    recordId: number,
  ): Promise<{ deleted: true }> {
    await this.access.assertOwner(projectId, userId)
    const existing = await this.prisma.recyclingRecord.findFirst({
      where: { id: recordId, projectId },
    })
    if (!existing) throw new NotFoundException('回收记录不存在')
    await this.prisma.recyclingRecord.delete({ where: { id: recordId } })
    return { deleted: true }
  }
}
