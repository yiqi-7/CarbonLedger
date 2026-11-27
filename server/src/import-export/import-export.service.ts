import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { RecordAccessService } from '../records/record-access.service'
import { RecordsService } from '../records/records.service'
import { AnalysisService } from '../analysis/analysis.service'
import {
  loadWorkbook,
  parseBuildMaterialWorkbook,
  parseConstructionWorkbook,
  parseTransportWorkbook,
} from './import-parsers'
import {
  buildBuildMaterialWorkbook,
  buildConstructionWorkbook,
  buildTransportWorkbook,
} from './list-exporters'
import {
  buildEmission,
  buildTotalPrice,
  CONSTRUCTION_ENERGY_TYPES,
  constructionEmission,
  constructionTotalEnergy,
  constructionTotalPrice,
  isRecyclingParticipant,
  transportEmission,
  transportTotalPrice,
} from '@carbonledger/shared'
import type { ConstructionEnergyType } from '@carbonledger/shared'

export interface ImportResult {
  imported: number
  skippedRows: number
  sheetName: string
}

@Injectable()
export class ImportExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: RecordAccessService,
    private readonly records: RecordsService,
    private readonly analysis: AnalysisService,
  ) {}

  // ==================== 导入 ====================

  /** 建材清单导入（旧版规则；导入后自动同步回收记录） */
  async importBuildMaterials(
    projectId: number,
    userId: number,
    file: Buffer,
  ): Promise<ImportResult> {
    await this.access.assertOwner(projectId, userId)
    const workbook = await loadWorkbook(file)
    const { materials, sheetName } = parseBuildMaterialWorkbook(workbook)

    const existing = await this.prisma.buildMaterial.findMany({ where: { projectId } })
    const existingKeys = new Set(
      existing.map(material => `${material.materialName}__${material.type}`),
    )
    const factorConfigs = await this.prisma.buildFactorConfig.findMany({
      where: { projectId },
      orderBy: { id: 'asc' },
    })
    const normalizeCategory = (category: string) => category === '钢材' ? '金属' : category
    const resolved = materials.map(material => {
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
      await this.records.syncRecycling(projectId, created.map(material => material.id))
    }
    return { imported: toInsert.length, skippedRows: materials.length - toInsert.length, sheetName }
  }

  /** 运输清单导入（旧版规则：重复车辆+货物视为已存在，不重复导入） */
  async importTransportRecords(
    projectId: number,
    userId: number,
    file: Buffer,
  ): Promise<ImportResult> {
    await this.access.assertOwner(projectId, userId)
    const workbook = await loadWorkbook(file)
    const { records, skippedRows } = parseTransportWorkbook(workbook)

    const existing = await this.prisma.transportRecord.findMany({ where: { projectId } })
    const existingKeys = new Set(
      existing.map(record => `${record.vehicleName}__${record.transportedMaterial}`),
    )
    const toInsert = records.filter(
      record => !existingKeys.has(`${record.vehicleName}__${record.transportedMaterial}`),
    )

    // 清单中的车辆若不在项目因子配置中，自动补齐配置（旧版为全局配置自动带入）
    for (const record of toInsert) {
      const config = await this.prisma.transportFactorConfig.findFirst({
        where: { projectId, vehicleName: record.vehicleName },
      })
      if (!config) {
        await this.prisma.transportFactorConfig.create({
          data: {
            projectId,
            vehicleName: record.vehicleName,
            energyType: record.energyType,
            emissionFactor: record.emissionFactor,
          },
        })
      }
    }

    if (toInsert.length > 0) {
      await this.prisma.transportRecord.createMany({
        data: toInsert.map(record => ({
          projectId,
          vehicleName: record.vehicleName,
          transportedMaterial: record.transportedMaterial,
          transportQuantity: record.transportQuantity,
          transportDistance: record.transportDistance,
          energyType: record.energyType,
          emissionFactor: record.emissionFactor,
          transportUnitPrice: record.transportUnitPrice,
          isCustomMaterial: false,
          emissionAmount: transportEmission(record.transportDistance, record.transportQuantity, record.emissionFactor),
          transportTotalPrice: transportTotalPrice(record.transportDistance, record.transportUnitPrice),
        })),
      })
    }
    return {
      imported: toInsert.length,
      skippedRows: skippedRows + (records.length - toInsert.length),
      sheetName: '运输碳排放量',
    }
  }

  /** 施工清单导入（旧版规则） */
  async importConstructionRecords(
    projectId: number,
    userId: number,
    file: Buffer,
  ): Promise<ImportResult> {
    await this.access.assertOwner(projectId, userId)
    const workbook = await loadWorkbook(file)
    const { records, skippedRows } = parseConstructionWorkbook(workbook)

    const existing = await this.prisma.constructionRecord.findMany({ where: { projectId } })
    const existingKeys = new Set(existing.map(record => record.machineryName))
    const toInsert = records.filter(record => !existingKeys.has(record.machineryName))

    if (toInsert.length > 0) {
      await this.prisma.constructionRecord.createMany({
        data: toInsert.map(record => {
          const energy = CONSTRUCTION_ENERGY_TYPES[record.energyType as ConstructionEnergyType]
          const totalEnergy = constructionTotalEnergy(record.shiftCount, record.energyPerShift)
          return {
            projectId,
            machineryName: record.machineryName,
            shiftCount: record.shiftCount,
            energyType: record.energyType,
            energyPerShift: record.energyPerShift,
            emissionFactor: record.emissionFactor,
            shiftUnitPrice: record.shiftUnitPrice,
            isCustomMaterial: false,
            energyUnit: energy.unit,
            totalEnergy,
            emissionAmount: constructionEmission(totalEnergy, record.emissionFactor),
            totalPrice: constructionTotalPrice(record.shiftCount, record.shiftUnitPrice),
          }
        }),
      })
    }
    return {
      imported: toInsert.length,
      skippedRows: skippedRows + (records.length - toInsert.length),
      sheetName: '施工碳排放量',
    }
  }

  // ==================== 导出 ====================

  async exportBuildMaterials(projectId: number, userId: number): Promise<Buffer> {
    const bundle = await this.analysis.buildBundle(projectId, userId)
    return buildBuildMaterialWorkbook(bundle.buildMaterials)
  }

  async exportTransportRecords(projectId: number, userId: number): Promise<Buffer> {
    const bundle = await this.analysis.buildBundle(projectId, userId)
    return buildTransportWorkbook(bundle.transportRecords)
  }

  async exportConstructionRecords(projectId: number, userId: number): Promise<Buffer> {
    const bundle = await this.analysis.buildBundle(projectId, userId)
    return buildConstructionWorkbook(bundle.constructionRecords)
  }
}
