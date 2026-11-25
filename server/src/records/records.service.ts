import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { ProjectsService } from '../projects/projects.service'
import {
  CONSTRUCTION_ENERGY_TYPES,
  isCountedConstructionRecord,
  mapRecyclingCategory,
  syncRecyclingRecords,
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
    private readonly projects: ProjectsService,
  ) {}

  // ==================== 建材 ====================

  async listBuildMaterials(projectId: number, userId: number): Promise<BuildMaterialRecord[]> {
    await this.projects.assertOwner(projectId, userId)
    return this.prisma.buildMaterial.findMany({
      where: { projectId },
      orderBy: { id: 'asc' },
    }) as unknown as BuildMaterialRecord[]
  }

  async createBuildMaterial(
    projectId: number,
    userId: number,
    dto: CreateBuildMaterialDto,
  ): Promise<BuildMaterialRecord> {
    await this.projects.assertOwner(projectId, userId)

    let materialName = dto.materialName?.trim()
    let type = dto.type?.trim()
    let unit = dto.unit?.trim()
    let emissionFactor = dto.emissionFactor
    let recyclingFactor = dto.recyclingFactor ?? 0
    let recyclingCoefficient = dto.recyclingCoefficient ?? 0
    let isCustomMaterial = true

    if (dto.factorConfigId) {
      const config = await this.prisma.buildFactorConfig.findFirst({
        where: { id: dto.factorConfigId, projectId },
      })
      if (!config) throw new NotFoundException('建材因子配置不存在')
      materialName = config.name
      type = config.category
      unit = config.materialUnit
      emissionFactor = config.emissionFactor
      recyclingFactor = config.recyclingFactor
      recyclingCoefficient = config.recyclingCoefficient
      isCustomMaterial = true
    } else {
      // 直录（导入场景）：名称/类别/单位/因子必须齐备
      if (!materialName || !type || !unit || emissionFactor == null) {
        throw new BadRequestException('请选择建材因子配置，或完整提供材料名称、类别、单位和碳排因子')
      }
    }

    const quantity = Number(dto.quantity)
    const unitPrice = Number(dto.unitPrice)
    const created = await this.prisma.buildMaterial.create({
      data: {
        projectId,
        materialName: materialName!,
        type: type!,
        quantity,
        unit: unit!,
        emissionFactor: Number(emissionFactor),
        marketPrice: dto.marketPrice == null ? null : Number(dto.marketPrice),
        unitPrice,
        recyclingFactor: Number(recyclingFactor),
        recyclingCoefficient: Number(recyclingCoefficient),
        isCustomMaterial,
        emissionAmount: (quantity * Number(emissionFactor)) / 1000,
        totalPrice: (quantity * unitPrice) / 10000,
        isParticipatingInRecyclingCalculation: Number(recyclingFactor) > 0,
      },
    })
    await this.syncRecycling(projectId)
    return created as unknown as BuildMaterialRecord
  }

  async updateBuildMaterial(
    projectId: number,
    userId: number,
    materialId: number,
    dto: UpdateBuildMaterialDto,
  ): Promise<BuildMaterialRecord> {
    await this.projects.assertOwner(projectId, userId)
    const existing = await this.prisma.buildMaterial.findFirst({
      where: { id: materialId, projectId },
    })
    if (!existing) throw new NotFoundException('建材记录不存在')

    const quantity = dto.quantity == null ? existing.quantity : Number(dto.quantity)
    const unitPrice = dto.unitPrice == null ? existing.unitPrice : Number(dto.unitPrice)
    const marketPrice =
      dto.marketPrice === undefined
        ? existing.marketPrice
        : dto.marketPrice === null
          ? null
          : Number(dto.marketPrice)

    const updated = await this.prisma.buildMaterial.update({
      where: { id: materialId },
      data: {
        quantity,
        unitPrice,
        marketPrice,
        emissionAmount: (quantity * existing.emissionFactor) / 1000,
        totalPrice: (quantity * unitPrice) / 10000,
      },
    })
    await this.syncRecycling(projectId)
    return updated as unknown as BuildMaterialRecord
  }

  async removeBuildMaterial(
    projectId: number,
    userId: number,
    materialId: number,
  ): Promise<{ deleted: true }> {
    await this.projects.assertOwner(projectId, userId)
    const existing = await this.prisma.buildMaterial.findFirst({
      where: { id: materialId, projectId },
    })
    if (!existing) throw new NotFoundException('建材记录不存在')

    // 旧版删除建材时：移除关联回收记录，并移除同名无来源的非自定义回收记录
    await this.prisma.recyclingRecord.deleteMany({
      where: {
        projectId,
        OR: [
          { sourceBuildMaterialId: materialId },
          {
            sourceBuildMaterialId: null,
            isCustomMaterial: false,
            materialName: existing.materialName,
          },
        ],
      },
    })
    await this.prisma.buildMaterial.delete({ where: { id: materialId } })
    await this.syncRecycling(projectId)
    return { deleted: true }
  }

  // ==================== 运输 ====================

  async listTransportRecords(projectId: number, userId: number): Promise<TransportRecord[]> {
    await this.projects.assertOwner(projectId, userId)
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
    await this.projects.assertOwner(projectId, userId)
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
        emissionAmount: (distance * quantity * config.emissionFactor) / 1000,
        transportTotalPrice: (distance * unitPrice) / 10000,
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
    await this.projects.assertOwner(projectId, userId)
    const existing = await this.prisma.transportRecord.findFirst({
      where: { id: recordId, projectId },
    })
    if (!existing) throw new NotFoundException('运输记录不存在')

    const quantity = dto.transportQuantity == null ? existing.transportQuantity : Number(dto.transportQuantity)
    const distance = dto.transportDistance == null ? existing.transportDistance : Number(dto.transportDistance)
    const unitPrice =
      dto.transportUnitPrice == null ? existing.transportUnitPrice : Number(dto.transportUnitPrice)
    const updated = await this.prisma.transportRecord.update({
      where: { id: recordId },
      data: {
        transportedMaterial: dto.transportedMaterial ?? existing.transportedMaterial,
        transportQuantity: quantity,
        transportDistance: distance,
        transportUnitPrice: unitPrice,
        emissionAmount: (distance * quantity * existing.emissionFactor) / 1000,
        transportTotalPrice: (distance * unitPrice) / 10000,
      },
    })
    return updated as unknown as TransportRecord
  }

  async removeTransportRecord(
    projectId: number,
    userId: number,
    recordId: number,
  ): Promise<{ deleted: true }> {
    await this.projects.assertOwner(projectId, userId)
    const existing = await this.prisma.transportRecord.findFirst({
      where: { id: recordId, projectId },
    })
    if (!existing) throw new NotFoundException('运输记录不存在')
    await this.prisma.transportRecord.delete({ where: { id: recordId } })
    return { deleted: true }
  }

  // ==================== 施工 ====================

  async listConstructionRecords(projectId: number, userId: number): Promise<ConstructionRecord[]> {
    await this.projects.assertOwner(projectId, userId)
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
    await this.projects.assertOwner(projectId, userId)
    const energy = CONSTRUCTION_ENERGY_TYPES[dto.energyType as ConstructionEnergyType]
    const emissionFactor = dto.emissionFactor == null ? energy.emissionFactor : Number(dto.emissionFactor)
    const shiftCount = Number(dto.shiftCount)
    const energyPerShift = Number(dto.energyPerShift)
    const shiftUnitPrice = Number(dto.shiftUnitPrice)
    const totalEnergy = shiftCount * energyPerShift

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
        emissionAmount: totalEnergy * emissionFactor,
        totalPrice: (shiftCount * shiftUnitPrice) / 10000,
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
    await this.projects.assertOwner(projectId, userId)
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
    const totalEnergy = shiftCount * energyPerShift

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
        emissionAmount: totalEnergy * emissionFactor,
        totalPrice: (shiftCount * shiftUnitPrice) / 10000,
      },
    })
    return updated as unknown as ConstructionRecord
  }

  async removeConstructionRecord(
    projectId: number,
    userId: number,
    recordId: number,
  ): Promise<{ deleted: true }> {
    await this.projects.assertOwner(projectId, userId)
    const existing = await this.prisma.constructionRecord.findFirst({
      where: { id: recordId, projectId },
    })
    if (!existing) throw new NotFoundException('施工记录不存在')
    await this.prisma.constructionRecord.delete({ where: { id: recordId } })
    return { deleted: true }
  }

  // ==================== 回收 ====================

  async listRecyclingRecords(projectId: number, userId: number): Promise<RecyclingRecord[]> {
    await this.projects.assertOwner(projectId, userId)
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
    await this.projects.assertOwner(projectId, userId)
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
        reductionAmount: (quantity * factor * coefficient) / 1000,
        residualValue: (quantity * unitPrice) / 10000,
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
    await this.projects.assertOwner(projectId, userId)
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
        reductionAmount: (quantity * factor * coefficient) / 1000,
        residualValue: (quantity * unitPrice) / 10000,
      },
    })
    return updated as unknown as RecyclingRecord
  }

  async removeRecyclingRecord(
    projectId: number,
    userId: number,
    recordId: number,
  ): Promise<{ deleted: true }> {
    await this.projects.assertOwner(projectId, userId)
    const existing = await this.prisma.recyclingRecord.findFirst({
      where: { id: recordId, projectId },
    })
    if (!existing) throw new NotFoundException('回收记录不存在')
    if (!existing.isCustomMaterial && existing.sourceBuildMaterialId != null) {
      throw new BadRequestException('自动联动的回收记录不能直接删除，请移除建材的回收因子或删除建材')
    }
    await this.prisma.recyclingRecord.delete({ where: { id: recordId } })
    return { deleted: true }
  }

  // ==================== 回收联动 ====================

  /**
   * 依据当前建材重建自动联动回收记录（旧版行为）：
   * - 回收因子 > 0 的建材 → 创建/更新关联记录，回收量 min(现值, 建材用量)；
   * - 回收因子归零或建材删除 → 移除关联记录；
   * - 自定义回收记录保持不变。
   */
  async syncRecycling(projectId: number): Promise<void> {
    const buildMaterials = await this.prisma.buildMaterial.findMany({ where: { projectId } })
    const recycling = await this.prisma.recyclingRecord.findMany({ where: { projectId } })

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
      const reductionAmount = (quantity * material.recyclingFactor * material.recyclingCoefficient) / 1000
      const residualValue = (quantity * unitPrice) / 10000

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