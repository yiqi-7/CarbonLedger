import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { ProjectsService } from '../projects/projects.service'
import { AnalysisService } from '../analysis/analysis.service'
import { AuditService } from '../audit/audit.service'
import type { CalcVersionSnapshot } from '@carbonledger/shared'
import { parseSnapshotOrThrow } from '../versions/snapshot'
import { ExcelReportRenderer } from './excel-report.renderer'
import { PdfReportRenderer } from './pdf-report.renderer'

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly analysis: AnalysisService,
    private readonly audit: AuditService,
    private readonly excelRenderer: ExcelReportRenderer,
    private readonly pdfRenderer: PdfReportRenderer,
  ) {}

  async getSnapshot(projectId: number, userId: number, versionId: number): Promise<CalcVersionSnapshot> {
    await this.projects.assertOwner(projectId, userId)
    const version = await this.prisma.calcVersion.findFirst({ where: { id: versionId, projectId } })
    if (!version) throw new NotFoundException('核算版本不存在')
    return parseSnapshotOrThrow(version.snapshot)
  }

  async currentSnapshot(projectId: number, userId: number): Promise<CalcVersionSnapshot> {
    const bundle = await this.analysis.buildBundle(projectId, userId)
    return {
      versionNumber: 0,
      savedAt: new Date().toISOString(),
      savedByUserId: userId,
      project: bundle.projectInfo,
      factors: bundle.factors,
      buildMaterials: bundle.buildMaterials,
      transportRecords: bundle.transportRecords,
      constructionRecords: bundle.constructionRecords,
      recyclingRecords: bundle.recyclingRecords,
      summary: bundle.summary,
    }
  }

  async exportCurrentExcel(projectId: number, userId: number): Promise<Buffer> {
    const bytes = await this.excelRenderer.render(await this.currentSnapshot(projectId, userId))
    await this.audit.record(userId, 'REPORT_EXPORTED', 'PROJECT', String(projectId), '当前核算 Excel')
    return bytes
  }

  async exportCurrentPdf(projectId: number, userId: number): Promise<Buffer> {
    const bytes = await this.pdfRenderer.render(await this.currentSnapshot(projectId, userId))
    await this.audit.record(userId, 'REPORT_EXPORTED', 'PROJECT', String(projectId), '当前核算 PDF')
    return bytes
  }

  async exportExcel(projectId: number, userId: number, versionId: number): Promise<Buffer> {
    const bytes = await this.excelRenderer.render(await this.getSnapshot(projectId, userId, versionId))
    await this.audit.record(userId, 'REPORT_EXPORTED', 'VERSION', String(versionId), '版本 Excel')
    return bytes
  }

  async exportPdf(projectId: number, userId: number, versionId: number): Promise<Buffer> {
    const bytes = await this.pdfRenderer.render(await this.getSnapshot(projectId, userId, versionId))
    await this.audit.record(userId, 'REPORT_EXPORTED', 'VERSION', String(versionId), '版本 PDF')
    return bytes
  }
}
