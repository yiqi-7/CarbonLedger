import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { BuildRecordService } from './build-record.service'
import { ConstructionRecordService } from './construction-record.service'
import { RecordAccessService } from './record-access.service'
import { RecyclingSyncService } from './recycling-sync.service'
import { TransportRecordService } from './transport-record.service'
import { recyclingReduction, recyclingResidualValue } from '@carbonledger/shared'
import type {
  BuildMaterialRecord,
  ConstructionRecord,
  RecyclingRecord,
  TransportRecord,
} from '@carbonledger/shared'
import type {
  CreateBuildMaterialDto,
  CreateConstructionRecordDto,
  CreateRecyclingRecordDto,
  CreateTransportRecordDto,
  UpdateBuildMaterialDto,
  UpdateConstructionRecordDto,
  UpdateRecyclingRecordDto,
  UpdateTransportRecordDto,
} from './records.dto'

/**
 * 四类核算记录服务：派生字段由服务端按共享引擎（旧版公式）计算后存储，
 * 回收记录随建材自动联动（旧版 syncRecyclingMaterialWithBuildMaterial 行为）。
 */
@Injectable()
export class RecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: RecordAccessService,
    private readonly recyclingSync: RecyclingSyncService,
    private readonly buildRecords: BuildRecordService,
    private readonly constructionRecords: ConstructionRecordService,
    private readonly transportRecords: TransportRecordService,
  ) {}

  // ==================== 建材 ====================

  async listBuildMaterials(projectId: number, userId: number): Promise<BuildMaterialRecord[]> {
    return this.buildRecords.listBuildMaterials(projectId, userId)
  }

  async createBuildMaterial(
    projectId: number,
    userId: number,
    dto: CreateBuildMaterialDto,
  ): Promise<BuildMaterialRecord> {
    return this.buildRecords.createBuildMaterial(projectId, userId, dto)
  }

  async updateBuildMaterial(
    projectId: number,
    userId: number,
    materialId: number,
    dto: UpdateBuildMaterialDto,
  ): Promise<BuildMaterialRecord> {
    return this.buildRecords.updateBuildMaterial(projectId, userId, materialId, dto)
  }

  async removeBuildMaterial(
    projectId: number,
    userId: number,
    materialId: number,
  ): Promise<{ deleted: true }> {
    return this.buildRecords.removeBuildMaterial(projectId, userId, materialId)
  }

  // ==================== 运输 ====================

  async listTransportRecords(projectId: number, userId: number): Promise<TransportRecord[]> {
    return this.transportRecords.listTransportRecords(projectId, userId)
  }

  async createTransportRecord(
    projectId: number,
    userId: number,
    dto: CreateTransportRecordDto,
  ): Promise<TransportRecord> {
    return this.transportRecords.createTransportRecord(projectId, userId, dto)
  }

  async updateTransportRecord(
    projectId: number,
    userId: number,
    recordId: number,
    dto: UpdateTransportRecordDto,
  ): Promise<TransportRecord> {
    return this.transportRecords.updateTransportRecord(projectId, userId, recordId, dto)
  }

  async removeTransportRecord(
    projectId: number,
    userId: number,
    recordId: number,
  ): Promise<{ deleted: true }> {
    return this.transportRecords.removeTransportRecord(projectId, userId, recordId)
  }

  // ==================== 施工 ====================

  async listConstructionRecords(projectId: number, userId: number): Promise<ConstructionRecord[]> {
    return this.constructionRecords.listConstructionRecords(projectId, userId)
  }

  async createConstructionRecord(
    projectId: number,
    userId: number,
    dto: CreateConstructionRecordDto,
  ): Promise<ConstructionRecord> {
    return this.constructionRecords.createConstructionRecord(projectId, userId, dto)
  }

  async updateConstructionRecord(
    projectId: number,
    userId: number,
    recordId: number,
    dto: UpdateConstructionRecordDto,
  ): Promise<ConstructionRecord> {
    return this.constructionRecords.updateConstructionRecord(projectId, userId, recordId, dto)
  }

  async removeConstructionRecord(
    projectId: number,
    userId: number,
    recordId: number,
  ): Promise<{ deleted: true }> {
    return this.constructionRecords.removeConstructionRecord(projectId, userId, recordId)
  }

  // ==================== 回收 ====================

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

  // ==================== 回收联动 ====================

  /** 兼容旧调用方，委托给独立的增量同步服务。 */
  async syncRecycling(projectId: number, materialIds: number[]): Promise<void> {
    return this.recyclingSync.syncRecycling(projectId, materialIds)
  }
}
