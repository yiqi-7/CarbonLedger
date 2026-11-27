import { Injectable } from '@nestjs/common'
import { RecordAccessService } from '../records/record-access.service'
import { RecordsService } from '../records/records.service'
import type {
  ImportedBuildMaterialsInput,
  ImportedConstructionRecordsInput,
  ImportedTransportRecordsInput,
} from '../records/records.service'
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
export interface ImportResult {
  imported: number
  skippedRows: number
  sheetName: string
}

@Injectable()
export class ImportExportService {
  constructor(
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
    // Authorization deliberately remains before workbook loading/parsing and all record reads.
    await this.access.assertOwner(projectId, userId)
    const workbook = await loadWorkbook(file)
    const { materials, sheetName } = parseBuildMaterialWorkbook(workbook)
    const input: ImportedBuildMaterialsInput = { materials }
    const result = await this.records.importBuildMaterials(projectId, input)
    return { ...result, sheetName }
  }

  /** 运输清单导入（旧版规则：重复车辆+货物视为已存在，不重复导入） */
  async importTransportRecords(
    projectId: number,
    userId: number,
    file: Buffer,
  ): Promise<ImportResult> {
    // Authorization deliberately remains before workbook loading/parsing and all record reads.
    await this.access.assertOwner(projectId, userId)
    const workbook = await loadWorkbook(file)
    const input: ImportedTransportRecordsInput = parseTransportWorkbook(workbook)
    const result = await this.records.importTransportRecords(projectId, input)
    return { ...result, sheetName: '运输碳排放量' }
  }

  /** 施工清单导入（旧版规则） */
  async importConstructionRecords(
    projectId: number,
    userId: number,
    file: Buffer,
  ): Promise<ImportResult> {
    // Authorization deliberately remains before workbook loading/parsing and all record reads.
    await this.access.assertOwner(projectId, userId)
    const workbook = await loadWorkbook(file)
    const input: ImportedConstructionRecordsInput = parseConstructionWorkbook(workbook)
    const result = await this.records.importConstructionRecords(projectId, input)
    return { ...result, sheetName: '施工碳排放量' }
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
