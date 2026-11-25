import { BadRequestException } from '@nestjs/common'
import ExcelJS from 'exceljs'
import { BUILD_MATERIAL_DEFAULT_UNITS, MAX_IMPORT_FILE_SIZE } from '@carbonledger/shared'
import type { TransportEnergyType, ConstructionEnergyType } from '@carbonledger/shared'

/**
 * 旧版 XLSX 导入规则的等价实现（表头别名、单位换算、跳过行、错误提示保持一致）。
 */

const EMPTY = (value: unknown): boolean => String(value ?? '').trim() === ''

/** 表头归一化（旧版 normalizeHeader：去空白、去掉括号内说明） */
export function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/\s/g, '')
    .replace(/[（(].*?[）)]/g, '')
}

export async function loadWorkbook(bytes: Buffer): Promise<ExcelJS.Workbook> {
  if (!bytes || bytes.length === 0) throw new BadRequestException('请选择有效的Excel文件')
  if (bytes.length > MAX_IMPORT_FILE_SIZE) throw new BadRequestException('Excel文件不能超过20MB')
  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.load(bytes as unknown as ArrayBuffer)
  } catch {
    throw new BadRequestException('Excel文件无法解析，请确认是有效的 .xlsx 文件')
  }
  return workbook
}

/** 读取工作表为二维数组（1-based 单元格索引映射为 0-based 列） */
export function readSheetRows(workbook: ExcelJS.Workbook, sheetName: string): unknown[][] | null {
  const sheet = workbook.getWorksheet(sheetName)
  if (!sheet) return null
  const rows: unknown[][] = []
  const rowCount = sheet.rowCount
  for (let rowNumber = 1; rowNumber <= rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber)
    const values: unknown[] = []
    for (let col = 1; col <= row.cellCount; col += 1) {
      const cell = row.getCell(col)
      const value = cell.value
      if (value == null) {
        values[col - 1] = ''
      } else if (typeof value === 'object' && 'result' in (value as object)) {
        values[col - 1] = (value as { result?: unknown }).result ?? ''
      } else if (typeof value === 'object' && 'text' in (value as object)) {
        values[col - 1] = (value as { text?: unknown }).text ?? ''
      } else {
        values[col - 1] = value
      }
    }
    rows.push(values)
  }
  return rows
}

/** 按候选表名依次查找（旧版：多个可选工作表名） */
export function locateSheet(
  workbook: ExcelJS.Workbook,
  candidates: string[],
): { name: string; rows: unknown[][] } | null {
  for (const name of candidates) {
    const rows = readSheetRows(workbook, name)
    if (rows) return { name, rows }
  }
  return null
}

function findExactOrPartial(headers: string[], aliases: string[]): number {
  const exact = headers.findIndex(header => aliases.includes(header))
  if (exact >= 0) return exact
  return headers.findIndex(header => aliases.some(alias => header.includes(alias)))
}

function requiredColumn(headers: string[], aliases: string[], label: string): number {
  const index = findExactOrPartial(headers, aliases)
  if (index < 0) throw new BadRequestException(`缺少“${label}”列`)
  return index
}

// ==================== 建材导入 ====================

export interface ImportedBuildMaterial {
  materialName: string
  type: string
  quantity: number
  unit: string
  emissionFactor: number
  marketPrice: number | null
  unitPrice: number
  recyclingFactor: number
  recyclingCoefficient: number
}

export function parseBuildMaterialWorkbook(workbook: ExcelJS.Workbook): {
  materials: ImportedBuildMaterial[]
  sheetName: string
} {
  const located = locateSheet(workbook, ['建材生产碳排放量', '材料清单'])
  if (!located) throw new BadRequestException('Excel文件中没有“建材生产碳排放量”工作表')
  const { rows, name: sheetName } = located

  const headerIndex = rows.findIndex(row => {
    const headers = row.map(normalizeHeader)
    return (
      headers.includes('材料名称') &&
      (headers.includes('类型') || headers.includes('材料类别')) &&
      (headers.includes('用量') || headers.includes('使用量'))
    )
  })
  if (headerIndex < 0) throw new BadRequestException(`${sheetName}工作表中没有有效的材料清单表头`)

  const headers = rows[headerIndex].map(normalizeHeader)
  const indexes = {
    materialName: findExactOrPartial(headers, ['材料名称']),
    type: findExactOrPartial(headers, ['类型', '材料类别']),
    quantity: findExactOrPartial(headers, ['用量', '使用量']),
    emissionFactor: findExactOrPartial(headers, ['碳排因子', '碳排放因子']),
    marketPrice: findExactOrPartial(headers, ['市场价', '市场价格']),
    unitPrice: findExactOrPartial(headers, ['单价', '成交价']),
    recyclingFactor: findExactOrPartial(headers, ['回收因子']),
    recyclingCoefficient: findExactOrPartial(headers, ['回收系数', '回收率', '再生系数', '可回收系数']),
  }
  const required: Array<[keyof typeof indexes, string]> = [
    ['materialName', '材料名称'],
    ['type', '材料类别'],
    ['quantity', '使用量'],
    ['emissionFactor', '碳排放因子'],
    ['unitPrice', '单价/成交价'],
  ]
  for (const [field, label] of required) {
    if (indexes[field] < 0) throw new BadRequestException(`${sheetName}工作表缺少“${label}”列`)
  }

  const materials: ImportedBuildMaterial[] = []
  for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? []
    if (row.every(value => EMPTY(value))) continue
    const valueFor = (field: keyof typeof indexes): string =>
      indexes[field] < 0 ? '' : String(row[indexes[field]] ?? '').trim()

    const materialName = valueFor('materialName')
    const type = valueFor('type')
    const quantityText = valueFor('quantity')
    const emissionFactorText = valueFor('emissionFactor')
    const unitPriceText = valueFor('unitPrice')
    if (![materialName, type, quantityText, emissionFactorText, unitPriceText].every(Boolean)) {
      throw new BadRequestException(
        `第 ${rowIndex + 1} 行材料名称、类型、用量、碳排放因子或单价不能为空`,
      )
    }
    const marketPriceText = valueFor('marketPrice')
    const recyclingFactorText = valueFor('recyclingFactor')
    const recyclingCoefficientText = valueFor('recyclingCoefficient')
    const quantity = Number(quantityText)
    const emissionFactor = Number(emissionFactorText)
    const marketPrice = marketPriceText ? Number(marketPriceText) : null
    const unitPrice = Number(unitPriceText)
    const recyclingFactor = recyclingFactorText ? Number(recyclingFactorText) : 0
    const recyclingCoefficient = recyclingCoefficientText ? Number(recyclingCoefficientText) : 0
    if (
      !Number.isFinite(quantity) || quantity <= 0 ||
      !Number.isFinite(emissionFactor) || emissionFactor <= 0 ||
      (marketPrice !== null && (!Number.isFinite(marketPrice) || marketPrice < 0)) ||
      !Number.isFinite(unitPrice) || unitPrice <= 0 ||
      !Number.isFinite(recyclingFactor) || recyclingFactor < 0 ||
      !Number.isFinite(recyclingCoefficient) || recyclingCoefficient < 0
    ) {
      throw new BadRequestException(
        `第 ${rowIndex + 1} 行用量、碳排放因子、单价、回收因子或回收系数无效`,
      )
    }
    const normalizedType = type === '钢材' ? '金属' : type
    materials.push({
      materialName,
      type: normalizedType,
      quantity,
      unit: BUILD_MATERIAL_DEFAULT_UNITS[normalizedType] ?? '',
      emissionFactor,
      marketPrice,
      unitPrice,
      recyclingFactor,
      recyclingCoefficient,
    })
  }
  return { materials, sheetName }
}

// ==================== 运输导入 ====================

export interface ImportedTransportRecord {
  vehicleName: string
  transportedMaterial: string
  transportQuantity: number
  transportDistance: number
  energyType: TransportEnergyType
  emissionFactor: number
  transportUnitPrice: number
}

export function parseTransportWorkbook(workbook: ExcelJS.Workbook): {
  records: ImportedTransportRecord[]
  skippedRows: number
} {
  const located = locateSheet(workbook, ['运输碳排放量', '运输记录清单', '运输记录'])
  if (!located) throw new BadRequestException('Excel文件中没有“运输碳排放量”工作表')
  const { rows } = located

  const headerIndex = rows.findIndex(row => {
    const headers = row.map(normalizeHeader)
    return (
      findExactOrPartial(headers, ['车辆名称', '车辆']) >= 0 &&
      findExactOrPartial(headers, ['运输货物', '货物']) >= 0 &&
      headers.some(header => header.includes('运输量'))
    )
  })
  if (headerIndex < 0) {
    throw new BadRequestException('运输碳排放量工作表没有有效的运输记录表头')
  }

  const headers = rows[headerIndex].map(normalizeHeader)
  const indexes = {
    vehicleName: requiredColumn(headers, ['车辆名称', '车辆'], '车辆名称'),
    transportedMaterial: requiredColumn(headers, ['运输货物'], '运输货物'),
    transportQuantity: requiredColumn(headers, ['运输量'], '运输量'),
    transportDistance: requiredColumn(headers, ['运距', '运输距离', '远距'], '运距'),
    energyType: requiredColumn(headers, ['能源类型'], '能源类型'),
    emissionFactor: requiredColumn(headers, ['碳排放因子', '碳排因子'], '碳排放因子'),
    transportUnitPrice: requiredColumn(headers, ['运输单价', '运输价'], '运输单价'),
  }
  const unitPriceInTenThousands = /万元/.test(
    String(rows[headerIndex][indexes.transportUnitPrice] ?? ''),
  )

  const records: ImportedTransportRecord[] = []
  let skippedRows = 0
  for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? []
    if (row.every(value => EMPTY(value))) continue
    const valueFor = (field: keyof typeof indexes): string =>
      String(row[indexes[field]] ?? '').trim()
    const vehicleName = valueFor('vehicleName')
    const transportedMaterial = valueFor('transportedMaterial')
    const quantityText = valueFor('transportQuantity')
    const distanceText = valueFor('transportDistance')
    const energyType = valueFor('energyType')
    const factorText = valueFor('emissionFactor')
    const priceText = valueFor('transportUnitPrice')
    if (
      ![
        vehicleName,
        quantityText,
        distanceText,
        energyType,
        factorText,
        priceText,
      ].every(Boolean)
    ) {
      skippedRows += 1
      continue
    }
    const quantity = Number(quantityText)
    const distance = Number(distanceText)
    const emissionFactor = Number(factorText)
    const unitPrice = Number(priceText)
    const transportUnitPrice = unitPrice * (unitPriceInTenThousands ? 10000 : 1)
    if (
      (energyType !== '柴油' && energyType !== '汽油') ||
      !Number.isFinite(quantity) || quantity <= 0 ||
      !Number.isFinite(distance) || distance <= 0 ||
      !Number.isFinite(emissionFactor) || emissionFactor <= 0 ||
      !Number.isFinite(unitPrice) || unitPrice < 0 ||
      !Number.isFinite(transportUnitPrice) || transportUnitPrice < 0
    ) {
      throw new BadRequestException(`第 ${rowIndex + 1} 行运输记录数值或能源类型无效`)
    }
    records.push({
      vehicleName,
      transportedMaterial,
      transportQuantity: quantity,
      transportDistance: distance,
      energyType,
      emissionFactor,
      transportUnitPrice,
    })
  }
  return { records, skippedRows }
}

// ==================== 施工导入 ====================

export interface ImportedConstructionRecord {
  machineryName: string
  shiftCount: number
  energyType: ConstructionEnergyType
  energyPerShift: number
  emissionFactor: number
  shiftUnitPrice: number
}

export function parseConstructionWorkbook(workbook: ExcelJS.Workbook): {
  records: ImportedConstructionRecord[]
  skippedRows: number
} {
  const located = locateSheet(workbook, ['施工碳排放量', '工程台班清单'])
  if (!located) throw new BadRequestException('Excel文件中没有“施工碳排放量”工作表')
  const { rows } = located

  const headerIndex = rows.findIndex(row => {
    const headers = row.map(normalizeHeader)
    return (
      headers.includes('机械名称') &&
      headers.includes('台班数') &&
      headers.includes('能源类型')
    )
  })
  if (headerIndex < 0) {
    throw new BadRequestException('施工碳排放量工作表没有有效的工程台班表头')
  }

  const headers = rows[headerIndex].map(normalizeHeader)
  const columns = {
    machineryName: '机械名称',
    shiftCount: '台班数',
    energyType: '能源类型',
    energyPerShift: '单位台班能耗',
    emissionFactor: '碳排放因子',
    shiftUnitPrice: '台班单价',
  }
  const indexes: Record<string, number> = {}
  for (const [field, label] of Object.entries(columns)) {
    indexes[field] = headers.indexOf(label)
    if (indexes[field] < 0) throw new BadRequestException(`工程台班清单缺少“${label}”列`)
  }

  const records: ImportedConstructionRecord[] = []
  let skippedRows = 0
  for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? []
    if (row.every(value => EMPTY(value))) continue
    const valueFor = (field: keyof typeof columns): string =>
      String(row[indexes[field]] ?? '').trim()
    const machineryName = valueFor('machineryName')
    const shiftCountText = valueFor('shiftCount')
    const energyType = valueFor('energyType')
    const energyPerShiftText = valueFor('energyPerShift')
    const factorText = valueFor('emissionFactor')
    const unitPriceText = valueFor('shiftUnitPrice')
    if (
      ![machineryName, shiftCountText, energyType, energyPerShiftText, factorText, unitPriceText].every(
        Boolean,
      )
    ) {
      skippedRows += 1
      continue
    }
    const shiftCount = Number(shiftCountText)
    const energyPerShift = Number(energyPerShiftText)
    const emissionFactor = Number(factorText)
    const shiftUnitPrice = Number(unitPriceText)
    if (
      (energyType !== '电力' && energyType !== '柴油' && energyType !== '汽油') ||
      !Number.isSafeInteger(shiftCount) || shiftCount <= 0 ||
      !Number.isFinite(energyPerShift) || energyPerShift <= 0 ||
      !Number.isFinite(emissionFactor) || emissionFactor <= 0 ||
      !Number.isFinite(shiftUnitPrice) || shiftUnitPrice <= 0
    ) {
      throw new BadRequestException(`第 ${rowIndex + 1} 行工程台班数据无效`)
    }
    records.push({
      machineryName,
      shiftCount,
      energyType,
      energyPerShift,
      emissionFactor,
      shiftUnitPrice,
    })
  }
  return { records, skippedRows }
}