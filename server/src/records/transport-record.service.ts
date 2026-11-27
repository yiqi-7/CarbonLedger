import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { RecordAccessService } from './record-access.service'
import { transportEmission, transportTotalPrice } from '@carbonledger/shared'
import type { TransportRecord } from '@carbonledger/shared'
import type { CreateTransportRecordDto, UpdateTransportRecordDto } from './records.dto'

/**
 * 运输记录的数据库与领域操作。
 * RecordsService 保留原有 public API，并通过本服务委托运输流程。
 */
@Injectable()
export class TransportRecordService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: RecordAccessService,
  ) {}

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
}
