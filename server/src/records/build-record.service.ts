import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { RecordAccessService } from './record-access.service'
import { RecyclingSyncService } from './recycling-sync.service'
import {
  buildEmission,
  buildTotalPrice,
  isRecyclingParticipant,
} from '@carbonledger/shared'
import type { BuildMaterialRecord } from '@carbonledger/shared'
import type {
  CreateBuildMaterialDto,
  UpdateBuildMaterialDto,
} from './records.dto'
import type {
  ImportedBuildMaterialsInput,
  ImportedRecordsWriteResult,
} from './import-inputs'

/**
 * 建材记录的数据库与领域操作。
 * RecordsService 保留原有 public API，并通过本服务委托建材流程。
 */
@Injectable()
export class BuildRecordService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: RecordAccessService,
    private readonly recyclingSync: RecyclingSyncService,
  ) {}

  async listBuildMaterials(projectId: number, userId: number): Promise<BuildMaterialRecord[]> {
    await this.access.assertOwner(projectId, userId)
    return this.prisma.buildMaterial.findMany({
      where: { projectId },
      orderBy: { id: 'asc' },
    }) as unknown as BuildMaterialRecord[]
  }

  /**
   * Authorized internal import entry point. The caller has already checked ownership;
   * keep this method free of a second access query while retaining project scoping.
   */
  async importBuildMaterials(
    projectId: number,
    input: ImportedBuildMaterialsInput,
  ): Promise<ImportedRecordsWriteResult> {
    const existing = await this.prisma.buildMaterial.findMany({ where: { projectId } })
    const existingKeys = new Set(
      existing.map(material => `${material.materialName}__${material.type}`),
    )
    const factorConfigs = await this.prisma.buildFactorConfig.findMany({
      where: { projectId },
      orderBy: { id: 'asc' },
    })
    const normalizeCategory = (category: string) => category === '钢材' ? '金属' : category
    const resolved = input.materials.map(material => {
      const exactConfig = factorConfigs.find(config =>
        config.name.trim().toLocaleLowerCase() === material.materialName.trim().toLocaleLowerCase(),
      )
      const exactCategory = exactConfig && normalizeCategory(exactConfig.category)
      const type = normalizeCategory(material.type) || exactCategory || '其他'
      const categoryUnits = [...new Set(factorConfigs
        .filter(config => normalizeCategory(config.category) === type && config.materialUnit)
        .map(config => config.materialUnit))]
      const unit = exactCategory === type && exactConfig?.materialUnit
        ? exactConfig.materialUnit
        : categoryUnits.length === 1
          ? categoryUnits[0]
          : material.unit || categoryUnits[0] || ''
      if (!unit) {
        throw new BadRequestException(`无法根据建材碳排配置唯一确定材料“${material.materialName}”（${type}）的单位，请在表格中补充“单位”列`)
      }
      return { ...material, type, unit }
    })
    const toInsert = resolved.filter(
      material => !existingKeys.has(`${material.materialName}__${material.type}`),
    )
    if (toInsert.length > 0) {
      const created = await this.prisma.$transaction(toInsert.map(material => this.prisma.buildMaterial.create({
        data: {
          projectId,
          materialName: material.materialName,
          type: material.type,
          quantity: material.quantity,
          unit: material.unit,
          emissionFactor: material.emissionFactor,
          marketPrice: material.marketPrice,
          unitPrice: material.unitPrice,
          recyclingFactor: material.recyclingFactor,
          recyclingCoefficient: material.recyclingCoefficient,
          isCustomMaterial: false,
          emissionAmount: buildEmission(material.quantity, material.emissionFactor),
          totalPrice: buildTotalPrice(material.quantity, material.unitPrice),
          isParticipatingInRecyclingCalculation: isRecyclingParticipant(material.recyclingFactor),
        },
      })))
      await this.recyclingSync.syncRecycling(projectId, created.map(material => material.id))
    }
    return { imported: toInsert.length, skippedRows: input.materials.length - toInsert.length }
  }

  async createBuildMaterial(
    projectId: number,
    userId: number,
    dto: CreateBuildMaterialDto,
  ): Promise<BuildMaterialRecord> {
    await this.access.assertOwner(projectId, userId)

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
        emissionAmount: buildEmission(quantity, Number(emissionFactor)),
        totalPrice: buildTotalPrice(quantity, unitPrice),
        isParticipatingInRecyclingCalculation: isRecyclingParticipant(Number(recyclingFactor)),
      },
    })
    await this.recyclingSync.syncRecycling(projectId, [created.id])
    return created as unknown as BuildMaterialRecord
  }

  async updateBuildMaterial(
    projectId: number,
    userId: number,
    materialId: number,
    dto: UpdateBuildMaterialDto,
  ): Promise<BuildMaterialRecord> {
    await this.access.assertOwner(projectId, userId)
    const existing = await this.prisma.buildMaterial.findFirst({
      where: { id: materialId, projectId },
    })
    if (!existing) throw new NotFoundException('建材记录不存在')

    const changeConfig = existing.isCustomMaterial && dto.factorConfigId != null
    const config = changeConfig
      ? await this.prisma.buildFactorConfig.findFirst({
          where: { id: dto.factorConfigId, projectId },
        })
      : null
    if (changeConfig && !config) throw new NotFoundException('建材因子配置不存在')
    const emissionFactor = config?.emissionFactor ?? existing.emissionFactor
    const recyclingFactor = config?.recyclingFactor ?? existing.recyclingFactor

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
        materialName: config?.name ?? existing.materialName,
        type: config?.category ?? existing.type,
        unit: config?.materialUnit ?? existing.unit,
        emissionFactor,
        recyclingFactor,
        recyclingCoefficient: config?.recyclingCoefficient ?? existing.recyclingCoefficient,
        isParticipatingInRecyclingCalculation: isRecyclingParticipant(recyclingFactor),
        quantity,
        unitPrice,
        marketPrice,
        emissionAmount: buildEmission(quantity, emissionFactor),
        totalPrice: buildTotalPrice(quantity, unitPrice),
      },
    })
    await this.recyclingSync.syncRecycling(projectId, [materialId])
    return updated as unknown as BuildMaterialRecord
  }

  async removeBuildMaterial(
    projectId: number,
    userId: number,
    materialId: number,
  ): Promise<{ deleted: true }> {
    await this.access.assertOwner(projectId, userId)
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
    return { deleted: true }
  }
}
