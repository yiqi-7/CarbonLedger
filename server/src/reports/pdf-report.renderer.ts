import PDFDocument from 'pdfkit'
import { Logger } from '@nestjs/common'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { CalcVersionSnapshot } from '@carbonledger/shared'
import { reportImagePng } from './report-image'

/** Renders a calculation snapshot into the PDF report format. */
export class PdfReportRenderer {
  private readonly logger = new Logger(PdfReportRenderer.name)

  async render(snapshot: CalcVersionSnapshot): Promise<Buffer> {
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
        // Continue with the next candidate font.
      }
    }
    return false
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
}
