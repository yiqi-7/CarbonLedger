import ExcelJS from 'exceljs'
import type {
  BuildMaterialRecord,
  ConstructionRecord,
  TransportRecord,
} from '@carbonledger/shared'

/**
 * 清单导出：列与工作表名与旧版导出文件一致。
 */

function newWorkbookWithSheet(sheetName: string): { workbook: ExcelJS.Workbook; sheet: ExcelJS.Worksheet } {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(sheetName)
  return { workbook, sheet }
}

function writeTable(
  sheet: ExcelJS.Worksheet,
  headers: Array<{ header: string; key: string; width?: number }>,
  rows: Array<Record<string, string | number | null>>,
): void {
  sheet.columns = headers.map(item => ({ header: item.header, key: item.key, width: item.width ?? 16 }))
  for (const row of rows) sheet.addRow(row)
  sheet.getRow(1).font = { bold: true }
}

/** 建材清单导出（旧版：材料清单工作表，8 列） */
export async function buildBuildMaterialWorkbook(
  materials: BuildMaterialRecord[],
): Promise<Buffer> {
  const { workbook, sheet } = newWorkbookWithSheet('材料清单')
  writeTable(
    sheet,
    [
      { header: '材料名称', key: 'materialName', width: 20 },
      { header: '类型', key: 'type', width: 14 },
      { header: '用量', key: 'quantity', width: 12 },
      { header: '碳排因子', key: 'emissionFactor', width: 14 },
      { header: '市场价（元）', key: 'marketPrice', width: 14 },
      { header: '成交价（元）', key: 'unitPrice', width: 14 },
      { header: '回收因子', key: 'recyclingFactor', width: 12 },
      { header: '回收系数', key: 'recyclingCoefficient', width: 12 },
    ],
    materials.map(material => ({
      materialName: material.materialName,
      type: material.type,
      quantity: material.quantity,
      emissionFactor: material.emissionFactor,
      marketPrice: material.marketPrice,
      unitPrice: material.unitPrice,
      recyclingFactor: material.recyclingFactor,
      recyclingCoefficient: material.recyclingCoefficient,
    })),
  )
  return toBuffer(workbook)
}

/** 运输清单导出（旧版：运输记录清单工作表，7 列） */
export async function buildTransportWorkbook(records: TransportRecord[]): Promise<Buffer> {
  const { workbook, sheet } = newWorkbookWithSheet('运输记录清单')
  writeTable(
    sheet,
    [
      { header: '车辆名称', key: 'vehicleName', width: 20 },
      { header: '运输货物', key: 'transportedMaterial', width: 20 },
      { header: '运输量', key: 'transportQuantity', width: 12 },
      { header: '运距', key: 'transportDistance', width: 12 },
      { header: '能源类型', key: 'energyType', width: 12 },
      { header: '碳排放因子', key: 'emissionFactor', width: 14 },
      { header: '运输单价（元）', key: 'transportUnitPrice', width: 16 },
    ],
    records.map(record => ({
      vehicleName: record.vehicleName,
      transportedMaterial: record.transportedMaterial,
      transportQuantity: record.transportQuantity,
      transportDistance: record.transportDistance,
      energyType: record.energyType,
      emissionFactor: record.emissionFactor,
      transportUnitPrice: record.transportUnitPrice,
    })),
  )
  return toBuffer(workbook)
}

/** 工程台班清单导出（旧版：工程台班清单工作表，6 列） */
export async function buildConstructionWorkbook(records: ConstructionRecord[]): Promise<Buffer> {
  const { workbook, sheet } = newWorkbookWithSheet('工程台班清单')
  writeTable(
    sheet,
    [
      { header: '机械名称', key: 'machineryName', width: 20 },
      { header: '台班数', key: 'shiftCount', width: 12 },
      { header: '能源类型', key: 'energyType', width: 12 },
      { header: '单位台班能耗', key: 'energyPerShift', width: 16 },
      { header: '碳排放因子', key: 'emissionFactor', width: 14 },
      { header: '台班单价（元）', key: 'shiftUnitPrice', width: 16 },
    ],
    records.map(record => ({
      machineryName: record.machineryName,
      shiftCount: record.shiftCount,
      energyType: record.energyType,
      energyPerShift: record.energyPerShift,
      emissionFactor: record.emissionFactor,
      shiftUnitPrice: record.shiftUnitPrice,
    })),
  )
  return toBuffer(workbook)
}

export async function toBuffer(workbook: ExcelJS.Workbook): Promise<Buffer> {
  const arrayBuffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer as ArrayBuffer)
}