import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import {
  CONSTRUCTION_ENERGY_TYPES,
  constructionEmission,
  constructionTotalEnergy,
  constructionTotalPrice,
} from '@carbonledger/shared'
import type { ConstructionEnergyType, ConstructionRecord } from '@carbonledger/shared'
import type { CreateConstructionRecordDto, UpdateConstructionRecordDto } from './records.dto'
import { RecordAccessService } from './record-access.service'

/**
 * 施工记录的数据库与领域操作。
 * RecordsService 保留原有 public API，并通过本服务委托施工流程。
 */
@Injectable()
export class ConstructionRecordService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: RecordAccessService,
  ) {}

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
}
