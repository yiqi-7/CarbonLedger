import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import ExcelJS from 'exceljs'
import PDFDocument from 'pdfkit'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaService } from '../prisma/prisma.service'
import { ProjectsService } from '../projects/projects.service'
import { AnalysisService } from '../analysis/analysis.service'
import { AuditService } from '../audit/audit.service'
import type { CalcVersionSnapshot } from '@carbonledger/shared'
import { reportImagePng } from './report-image'

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly analysis: AnalysisService,
    private readonly audit: AuditService,
  ) {}

  async getSnapshot(projectId: number, userId: number, versionId: number): Promise<CalcVersionSnapshot> {
    await this.projects.assertOwner(projectId, userId)
    const version = await this.prisma.calcVersion.findFirst({ where: { id: versionId, projectId } })
    if (!version) throw new NotFoundException('核算版本不存在')
    return JSON.parse(version.snapshot) as CalcVersionSnapshot
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
    const bytes = await this.renderExcel(await this.currentSnapshot(projectId, userId))
    await this.audit.record(userId, 'REPORT_EXPORTED', 'PROJECT', String(projectId), '当前核算 Excel')
    return bytes
  }

  async exportCurrentPdf(projectId: number, userId: number): Promise<Buffer> {
    const bytes = await this.renderPdf(await this.currentSnapshot(projectId, userId))
    await this.audit.record(userId, 'REPORT_EXPORTED', 'PROJECT', String(projectId), '当前核算 PDF')
    return bytes
  }

  async exportExcel(projectId: number, userId: number, versionId: number): Promise<Buffer> {
    const bytes = await this.renderExcel(await this.getSnapshot(projectId, userId, versionId))
    await this.audit.record(userId, 'REPORT_EXPORTED', 'VERSION', String(versionId), '版本 Excel')
    return bytes
  }

  async exportPdf(projectId: number, userId: number, versionId: number): Promise<Buffer> {
    const bytes = await this.renderPdf(await this.getSnapshot(projectId, userId, versionId))
    await this.audit.record(userId, 'REPORT_EXPORTED', 'VERSION', String(versionId), '版本 PDF')
    return bytes
  }

  private async renderExcel(snapshot: CalcVersionSnapshot): Promise<Buffer> {
    const templatePath = join(process.cwd(), 'assets', 'legacy', '报告书导出.xlsx')
    const workbook = new ExcelJS.Workbook()
    if (existsSync(templatePath)) await workbook.xlsx.readFile(templatePath)
    else this.createFallbackTemplate(workbook)

    const overview = workbook.getWorksheet('项目总览') ?? workbook.worksheets[0]
    const imagePng = await reportImagePng(snapshot.project.modelImage)
    this.setCells(overview, {
      B2: snapshot.project.projectName,
      B3: [snapshot.project.province, snapshot.project.cityDistrict, snapshot.project.address].filter(Boolean).join(' '),
      B4: snapshot.project.buildingArea,
      B5: snapshot.project.buildingType,
      B6: imagePng ? '' : snapshot.project.modelImage ? '图片无法读取' : '未提供',
      A9: '净碳排放总量（tCO₂e）',
      F9: '单位建筑面积净碳排放量（kgCO₂e/㎡）',
      A10: snapshot.summary.emission.netEmission,
      B10: snapshot.summary.build.totalEmission,
      C10: snapshot.summary.transport.totalEmission,
      D10: snapshot.summary.construction.totalEmission,
      E10: -snapshot.summary.recycling.totalReduction,
      F10: snapshot.summary.emission.unitAreaNetEmission,
      G10: snapshot.summary.cost.totalCost,
      H10: snapshot.summary.cost.unitCostEmission,
      I10: snapshot.summary.cost.unitAreaBuildCost,
    })
    if (overview && imagePng) {
      const imageBuffer = Buffer.from(imagePng)
      const imageId = workbook.addImage({ buffer: imageBuffer as never, extension: 'png' })
      overview.addImage(imageId, { tl: { col: 1, row: 5 }, ext: { width: 120, height: 80 } } as never)
      if (overview.getRow(6).height < 62) overview.getRow(6).height = 62
    }

    this.fillBuildSheet(workbook.getWorksheet('建材生产碳排放量'), snapshot)
    this.fillTransportSheet(workbook.getWorksheet('运输碳排放量'), snapshot)
    this.fillConstructionSheet(workbook.getWorksheet('施工碳排放量'), snapshot)
    this.fillRecyclingSheet(workbook.getWorksheet('回收碳排放量'), snapshot)

    const result = await workbook.xlsx.writeBuffer()
    return Buffer.from(result as ArrayBuffer)
  }

  private applyCjkFont(document: PDFKit.PDFDocument): boolean {
    const candidates: Array<{ path: string; family?: string }> = [
      { path: join(process.cwd(), 'assets', 'fonts', 'NotoSansSC-Regular.otf') },
      { path: join(process.cwd(), 'assets', 'fonts', 'simsun.ttc'), family: 'SimSun' },
      { path: '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', family: 'Noto Sans CJK SC' },
      { path: '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc', family: 'Noto Sans CJK SC' },
      { path: '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc', family: 'WenQuanYi Zen Hei' },
      { path: '/usr/share/fonts/truetype/arphic/uming.ttc', family: 'AR PL UMing CN' },
      { path: 'C:\\Windows\\Fonts\\simsun.ttc', family: 'SimSun' },
      { path: 'C:\\Windows\\Fonts\\msyh.ttc', family: 'Microsoft YaHei' },
    ]
    for (const candidate of candidates) {
      if (!existsSync(candidate.path)) continue
      try {
        if (candidate.family) document.font(candidate.path, candidate.family)
        else document.font(candidate.path)
        return true
      } catch {
        // 继续尝试下一个候选字体
      }
    }
    return false
  }

  private async renderPdf(snapshot: CalcVersionSnapshot): Promise<Buffer> {
    const document = new PDFDocument({ size: 'A4', margin: 42 })
    if (!this.applyCjkFont(document)) {
      this.logger.warn('未找到可用的中文字体，PDF 中的中文可能无法正确显示')
    }

    const chunks: Buffer[] = []
    document.on('data', chunk => chunks.push(Buffer.from(chunk)))
    const completed = new Promise<Buffer>((resolve, reject) => {
      document.on('end', () => resolve(Buffer.concat(chunks)))
      document.on('error', reject)
    })

    document.fontSize(20).text('建筑碳排放核算报告', { align: 'center' })
    document.moveDown(0.8)
    document.fontSize(11)
    document.text(`项目名称：${snapshot.project.projectName}`)
    document.text(`项目地点：${[snapshot.project.province, snapshot.project.cityDistrict, snapshot.project.address].filter(Boolean).join(' ')}`)
    document.text(`建筑面积：${snapshot.project.buildingArea} ㎡`)
    document.text(`核算标准：${snapshot.project.accountingStandard}`)
    document.text(`版本号：v${snapshot.versionNumber}    保存时间：${snapshot.savedAt}`)
    const imagePng = await reportImagePng(snapshot.project.modelImage)
    if (imagePng) {
      document.moveDown(0.4)
      document.image(imagePng, { fit: [220, 140], align: 'center' })
    }

    document.moveDown(0.8)
    document.fontSize(14).text('一、生命周期碳排放汇总')
    document.fontSize(10)
    for (const stage of snapshot.summary.emission.stages) {
      document.text(`${stage.name}：${stage.emission.toFixed(6)} tCO₂e`)
    }
    document.text(`净碳排放：${snapshot.summary.emission.netEmission.toFixed(6)} tCO₂e`)
    document.text(`单位面积净排放：${snapshot.summary.emission.unitAreaNetEmission.toFixed(6)} kgCO₂e/㎡`)

    document.moveDown(0.8)
    document.fontSize(14).text('二、成本汇总')
    document.fontSize(10)
    document.text(`总成本：${snapshot.summary.cost.totalCost.toFixed(6)} 万元`)
    document.text(`单位面积建材成本：${snapshot.summary.cost.unitAreaBuildCost.toFixed(6)} 万元/㎡`)
    document.text(`单位成本碳排：${snapshot.summary.cost.unitCostEmission.toFixed(6)} tCO₂e/万元`)

    this.pdfTable(document, '三、建材生产清单', ['材料', '类别', '用量', '碳排（t）'], snapshot.buildMaterials.map(item => [
      item.materialName, item.type, String(item.quantity), item.emissionAmount.toFixed(6),
    ]))
    this.pdfTable(document, '四、运输清单', ['车辆', '货物', '运量', '碳排（t）'], snapshot.transportRecords.map(item => [
      item.vehicleName, item.transportedMaterial, String(item.transportQuantity), item.emissionAmount.toFixed(6),
    ]))
    this.pdfTable(document, '五、施工清单', ['机械', '能源', '台班', '碳排（t）'], snapshot.constructionRecords.map(item => [
      item.machineryName, item.energyType, String(item.shiftCount), (item.emissionAmount / 1000).toFixed(6),
    ]))
    this.pdfTable(document, '六、回收减排清单', ['材料', '类别', '回收量', '减排（t）'], snapshot.recyclingRecords.map(item => [
      item.materialName, item.materialType, String(item.recyclingQuantity), item.reductionAmount.toFixed(6),
    ]))

    document.end()
    return completed
  }

  private setCells(sheet: ExcelJS.Worksheet | undefined, values: Record<string, string | number>): void {
    if (!sheet) return
    for (const [address, value] of Object.entries(values)) sheet.getCell(address).value = value
  }

  private clearDataRows(sheet: ExcelJS.Worksheet | undefined, firstRow: number, columnCount: number): void {
    if (!sheet) return
    for (let row = firstRow; row <= sheet.rowCount; row += 1) {
      for (let col = 1; col <= columnCount; col += 1) sheet.getRow(row).getCell(col).value = null
    }
  }

  private fillBuildSheet(sheet: ExcelJS.Worksheet | undefined, snapshot: CalcVersionSnapshot): void {
    if (!sheet) return
    this.clearDataRows(sheet, 3, 11)
    snapshot.buildMaterials.forEach((item, index) => {
      sheet.getRow(index + 3).values = [
        index + 1, item.materialName, item.type, item.quantity, item.emissionFactor,
        item.emissionAmount, item.marketPrice == null ? null : item.marketPrice / 10000,
        item.unitPrice / 10000, item.totalPrice, item.recyclingFactor, item.recyclingCoefficient,
      ]
    })
    sheet.getCell('E1').value = `${snapshot.summary.build.totalEmission.toFixed(3)} tCO₂e`
  }

  private fillTransportSheet(sheet: ExcelJS.Worksheet | undefined, snapshot: CalcVersionSnapshot): void {
    if (!sheet) return
    this.clearDataRows(sheet, 3, 10)
    snapshot.transportRecords.forEach((item, index) => {
      sheet.getRow(index + 3).values = [
        index + 1, item.vehicleName, item.transportedMaterial, item.transportQuantity,
        item.transportDistance, item.energyType, item.emissionFactor, item.emissionAmount,
        item.transportUnitPrice / 10000, item.transportTotalPrice,
      ]
    })
    sheet.getCell('F1').value = `${snapshot.summary.transport.totalEmission.toFixed(3)} tCO₂e`
  }

  private fillConstructionSheet(sheet: ExcelJS.Worksheet | undefined, snapshot: CalcVersionSnapshot): void {
    if (!sheet) return
    this.clearDataRows(sheet, 3, 10)
    snapshot.constructionRecords.forEach((item, index) => {
      sheet.getRow(index + 3).values = [
        index + 1, item.machineryName, item.shiftCount, item.energyType, item.energyPerShift,
        item.totalEnergy, item.emissionFactor, item.emissionAmount / 1000,
        item.shiftUnitPrice / 10000, item.totalPrice,
      ]
    })
    sheet.getCell('G1').value = `${snapshot.summary.construction.totalEmission.toFixed(3)} tCO₂e`
  }

  private fillRecyclingSheet(sheet: ExcelJS.Worksheet | undefined, snapshot: CalcVersionSnapshot): void {
    if (!sheet) return
    this.clearDataRows(sheet, 3, 9)
    snapshot.recyclingRecords.forEach((item, index) => {
      sheet.getRow(index + 3).values = [
        index + 1, item.materialName, item.materialType, item.recyclingQuantity,
        item.recyclingFactor, item.recyclingCoefficient, item.reductionAmount,
        item.recyclingUnitPrice / 10000, item.residualValue,
      ]
    })
    sheet.getCell('F1').value = `${snapshot.summary.recycling.totalReduction.toFixed(3)} tCO₂e`
  }

  private pdfTable(
    document: PDFKit.PDFDocument,
    title: string,
    headers: string[],
    rows: string[][],
  ): void {
    document.moveDown(0.8)
    document.fontSize(14).text(title)
    document.fontSize(8)
    document.text(headers.join(' | '))
    for (const row of rows) {
      if (document.y > 760) document.addPage()
      document.text(row.join(' | '))
    }
  }

  private createFallbackTemplate(workbook: ExcelJS.Workbook): void {
    workbook.addWorksheet('项目总览')
    workbook.addWorksheet('建材生产碳排放量')
    workbook.addWorksheet('运输碳排放量')
    workbook.addWorksheet('施工碳排放量')
    workbook.addWorksheet('回收碳排放量')
  }
}
