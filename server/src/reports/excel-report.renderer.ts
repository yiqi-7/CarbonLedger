import ExcelJS from 'exceljs'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { CalcVersionSnapshot } from '@carbonledger/shared'
import { reportImagePng } from './report-image'

/** Renders a calculation snapshot into the legacy workbook format. */
export class ExcelReportRenderer {
  async render(snapshot: CalcVersionSnapshot): Promise<Buffer> {
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
      const imageId = workbook.addImage({ buffer: imagePng as never, extension: 'png' })
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

  private createFallbackTemplate(workbook: ExcelJS.Workbook): void {
    workbook.addWorksheet('项目总览')
    workbook.addWorksheet('建材生产碳排放量')
    workbook.addWorksheet('运输碳排放量')
    workbook.addWorksheet('施工碳排放量')
    workbook.addWorksheet('回收碳排放量')
  }
}
