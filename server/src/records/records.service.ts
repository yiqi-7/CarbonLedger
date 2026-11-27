import { Injectable } from '@nestjs/common'
import { BuildRecordService } from './build-record.service'
import { ConstructionRecordService } from './construction-record.service'
import { RecyclingRecordService } from './recycling-record.service'
import { RecyclingSyncService } from './recycling-sync.service'
import { TransportRecordService } from './transport-record.service'
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
    private readonly recyclingSync: RecyclingSyncService,
    private readonly recyclingRecords: RecyclingRecordService,
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
    return this.recyclingRecords.listRecyclingRecords(projectId, userId)
  }

  async createRecyclingRecord(
    projectId: number,
    userId: number,
    dto: CreateRecyclingRecordDto,
  ): Promise<RecyclingRecord> {
    return this.recyclingRecords.createRecyclingRecord(projectId, userId, dto)
  }

  async updateRecyclingRecord(
    projectId: number,
    userId: number,
    recordId: number,
    dto: UpdateRecyclingRecordDto,
  ): Promise<RecyclingRecord> {
    return this.recyclingRecords.updateRecyclingRecord(projectId, userId, recordId, dto)
  }

  async removeRecyclingRecord(
    projectId: number,
    userId: number,
    recordId: number,
  ): Promise<{ deleted: true }> {
    return this.recyclingRecords.removeRecyclingRecord(projectId, userId, recordId)
  }

  // ==================== 回收联动 ====================

  /** 兼容旧调用方，委托给独立的增量同步服务。 */
  async syncRecycling(projectId: number, materialIds: number[]): Promise<void> {
    return this.recyclingSync.syncRecycling(projectId, materialIds)
  }
}
