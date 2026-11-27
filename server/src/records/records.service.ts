import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { BuildRecordService } from './build-record.service'
import { RecordAccessService } from './record-access.service'
import { RecyclingSyncService } from './recycling-sync.service'
import {
  CONSTRUCTION_ENERGY_TYPES,
  constructionEmission,
  constructionTotalEnergy,
  constructionTotalPrice,
  recyclingReduction,
  recyclingResidualValue,
  transportEmission,
  transportTotalPrice,
} from '@carbonledger/shared'
import type {
  BuildMaterialRecord,
  ConstructionEnergyType,
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
    await this.access.assertOwner(projectId, userId)
    return this.prisma.transportRecord.findMany({
      where: { projectId },
      orderBy: { id: 'asc' },
    }) as unknown as TransportRecord[]
  }

  async createTransportRecord(
    projectId: number,
    userId: number,
    dto: CreateTransportRecordDto,
  ): Promise<TransportRecord> {
    await this.access.assertOwner(projectId, userId)
    const config = await this.prisma.transportFactorConfig.findFirst({
      where: { id: dto.factorConfigId, projectId },
    })
    if (!config) throw new NotFoundException('车辆配置不存在，请先在因子配置中添加运输方式')

    const quantity = Number(dto.transportQuantity)
    const distance = Number(dto.transportDistance)
    const unitPrice = Number(dto.transportUnitPrice)
    const created = await this.prisma.transportRecord.create({
      data: {
        projectId,
        vehicleName: config.vehicleName,
        transportedMaterial: dto.transportedMaterial,
        transportQuantity: quantity,
        transportDistance: distance,
        energyType: config.energyType,
        emissionFactor: config.emissionFactor,
        transportUnitPrice: unitPrice,
        isCustomMaterial: true,
        emissionAmount: transportEmission(distance, quantity, config.emissionFactor),
        transportTotalPrice: transportTotalPrice(distance, unitPrice),
      },
    })
    return created as unknown as TransportRecord
  }

  async updateTransportRecord(
    projectId: number,
    userId: number,
    recordId: number,
    dto: UpdateTransportRecordDto,
  ): Promise<TransportRecord> {
    await this.access.assertOwner(projectId, userId)
    const existing = await this.prisma.transportRecord.findFirst({
      where: { id: recordId, projectId },
    })
    if (!existing) throw new NotFoundException('运输记录不存在')

    let vehicleName = existing.vehicleName
    let energyType = existing.energyType
    let emissionFactor = existing.emissionFactor
    if (existing.isCustomMaterial && dto.factorConfigId != null) {
      const config = await this.prisma.transportFactorConfig.findFirst({
        where: { id: dto.factorConfigId, projectId },
      })
      if (!config) throw new NotFoundException('车辆配置不存在，请先在因子配置中添加运输方式')
      vehicleName = config.vehicleName
      energyType = config.energyType
      emissionFactor = config.emissionFactor
    }

    const quantity = dto.transportQuantity == null ? existing.transportQuantity : Number(dto.transportQuantity)
    const distance = dto.transportDistance == null ? existing.transportDistance : Number(dto.transportDistance)
    const unitPrice =
      dto.transportUnitPrice == null ? existing.transportUnitPrice : Number(dto.transportUnitPrice)
    const updated = await this.prisma.transportRecord.update({
      where: { id: recordId },
      data: {
        vehicleName,
        energyType,
        emissionFactor,
        transportedMaterial: dto.transportedMaterial ?? existing.transportedMaterial,
        transportQuantity: quantity,
        transportDistance: distance,
        transportUnitPrice: unitPrice,
        emissionAmount: transportEmission(distance, quantity, emissionFactor),
        transportTotalPrice: transportTotalPrice(distance, unitPrice),
      },
    })
    return updated as unknown as TransportRecord
  }

  async removeTransportRecord(
    projectId: number,
    userId: number,
    recordId: number,
  ): Promise<{ deleted: true }> {
    await this.access.assertOwner(projectId, userId)
    const existing = await this.prisma.transportRecord.findFirst({
      where: { id: recordId, projectId },
    })
    if (!existing) throw new NotFoundException('运输记录不存在')
    await this.prisma.transportRecord.delete({ where: { id: recordId } })
    return { deleted: true }
  }

  // ==================== 施工 ====================

  async listConstructionRecords(projectId: number, userId: number): Promise<ConstructionRecord[]> {
    await this.access.assertOwner(projectId, userId)
    return this.prisma.constructionRecord.findMany({
      where: { projectId },
      orderBy: { id: 'asc' },
    }) as unknown as ConstructionRecord[]
  }

  async createConstructionRecord(
    projectId: number,
    userId: number,
    dto: CreateConstructionRecordDto,
  ): Promise<ConstructionRecord> {
    await this.access.assertOwner(projectId, userId)
    const energy = CONSTRUCTION_ENERGY_TYPES[dto.energyType as ConstructionEnergyType]
    const emissionFactor = dto.emissionFactor == null ? energy.emissionFactor : Number(dto.emissionFactor)
    const shiftCount = Number(dto.shiftCount)
    const energyPerShift = Number(dto.energyPerShift)
    const shiftUnitPrice = Number(dto.shiftUnitPrice)
    const totalEnergy = constructionTotalEnergy(shiftCount, energyPerShift)

    const created = await this.prisma.constructionRecord.create({
      data: {
        projectId,
        machineryName: dto.machineryName,
        shiftCount,
        energyType: dto.energyType,
        energyPerShift,
        emissionFactor,
        shiftUnitPrice,
        isCustomMaterial: true,
        energyUnit: energy.unit,
        totalEnergy,
        emissionAmount: constructionEmission(totalEnergy, emissionFactor),
        totalPrice: constructionTotalPrice(shiftCount, shiftUnitPrice),
      },
    })
    return created as unknown as ConstructionRecord
  }

  async updateConstructionRecord(
    projectId: number,
    userId: number,
    recordId: number,
    dto: UpdateConstructionRecordDto,
  ): Promise<ConstructionRecord> {
    await this.access.assertOwner(projectId, userId)
    const existing = await this.prisma.constructionRecord.findFirst({
      where: { id: recordId, projectId },
    })
    if (!existing) throw new NotFoundException('施工记录不存在')

    // 旧版：导入行仅台班数与单价可编辑；自定义行可编辑机械名/台班数/能源/能耗/单价
    const energyType = (existing.isCustomMaterial ? dto.energyType ?? existing.energyType : existing.energyType) as ConstructionEnergyType
    const energy = CONSTRUCTION_ENERGY_TYPES[energyType]
    const machineryName = existing.isCustomMaterial
      ? (dto.machineryName ?? existing.machineryName)
      : existing.machineryName
    const energyPerShift = existing.isCustomMaterial
      ? (dto.energyPerShift ?? existing.energyPerShift)
      : existing.energyPerShift
    const shiftCount = dto.shiftCount == null ? existing.shiftCount : Number(dto.shiftCount)
    const shiftUnitPrice =
      dto.shiftUnitPrice == null ? existing.shiftUnitPrice : Number(dto.shiftUnitPrice)
    const emissionFactor =
      existing.isCustomMaterial && dto.energyType && dto.energyType !== existing.energyType
        ? energy.emissionFactor
        : existing.emissionFactor
    if (!machineryName.trim()) throw new BadRequestException('机械名称不能为空')
    const totalEnergy = constructionTotalEnergy(shiftCount, energyPerShift)

    const updated = await this.prisma.constructionRecord.update({
      where: { id: recordId },
      data: {
        machineryName,
        shiftCount,
        energyType,
        energyPerShift,
        emissionFactor,
        shiftUnitPrice,
        energyUnit: energy.unit,
        totalEnergy,
        emissionAmount: constructionEmission(totalEnergy, emissionFactor),
        totalPrice: constructionTotalPrice(shiftCount, shiftUnitPrice),
      },
    })
    return updated as unknown as ConstructionRecord
  }

  async removeConstructionRecord(
    projectId: number,
    userId: number,
    recordId: number,
  ): Promise<{ deleted: true }> {
    await this.access.assertOwner(projectId, userId)
    const existing = await this.prisma.constructionRecord.findFirst({
      where: { id: recordId, projectId },
    })
    if (!existing) throw new NotFoundException('施工记录不存在')
    await this.prisma.constructionRecord.delete({ where: { id: recordId } })
    return { deleted: true }
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
