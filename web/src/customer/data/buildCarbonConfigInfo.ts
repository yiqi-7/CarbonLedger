import { readWorkbookSheetRows } from './transportCarbonConfigInfo'

export interface BuildCarbonConfigInfoInput {
  category: string
  name: string
  emissionFactor: number
  materialUnit: string
  recyclingFactor?: number
  recyclingCoefficient?: number
}

export class BuildCarbonConfigInfo {
  category: string
  name: string
  emissionFactor: number
  materialUnit: string
  recyclingFactor: number
  recyclingCoefficient: number

  constructor({
    category,
    name,
    emissionFactor,
    materialUnit,
    recyclingFactor = 0,
    recyclingCoefficient = 0
  }: BuildCarbonConfigInfoInput) {
    this.category = category
    this.name = name
    this.emissionFactor = emissionFactor
    this.materialUnit = materialUnit
    this.recyclingFactor = recyclingFactor
    this.recyclingCoefficient = recyclingCoefficient
  }
}

class BuildCarbonConfigNode {
  configuration: BuildCarbonConfigInfo
  next: BuildCarbonConfigNode | null

  constructor(configuration: BuildCarbonConfigInfo) {
    this.configuration = configuration
    this.next = null
  }
}

export class BuildCarbonConfigInfoList {
  head: BuildCarbonConfigNode | null
  count: number

  constructor(configurations: BuildCarbonConfigInfo[] = []) {
    this.head = null
    this.count = 0
    configurations.forEach(configuration => this.append(configuration))
  }

  append(configuration: BuildCarbonConfigInfo): BuildCarbonConfigInfo {
    const node = new BuildCarbonConfigNode(configuration)
    if (!this.head) {
      this.head = node
    } else {
      let current = this.head
      while (current.next) current = current.next
      current.next = node
    }
    this.count += 1
    return node.configuration
  }

  replaceAll(configurations: BuildCarbonConfigInfo[]): void {
    this.head = null
    this.count = 0
    configurations.forEach(configuration => this.append(configuration))
  }

  toArray(): BuildCarbonConfigInfo[] {
    const configurations: BuildCarbonConfigInfo[] = []
    let current = this.head
    while (current) {
      configurations.push(current.configuration)
      current = current.next
    }
    return configurations
  }
}

function normalizedHeader(value: unknown): string {
  return String(value ?? '').trim().replace(/\s/g, '').replace(/[（(].*?[）)]/g, '')
}

function numericValue(value: unknown, header: string, rowNumber: number, allowEmpty = false): number {
  const text = String(value ?? '').trim()
  if (allowEmpty && (!text || ['-', '—', '–', '/', '无', '暂无'].includes(text))) return 0
  const number = Number(text)
  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`建筑碳排配置第 ${rowNumber} 行“${header}”数据无效：${text}`)
  }
  return number
}

export function parseBuildCarbonConfigWorkbook(workbookBytes: Uint8Array): BuildCarbonConfigInfo[] {
  const rows = readWorkbookSheetRows(workbookBytes, '建筑碳排配置')
  if (!rows) return []

  const headerRowIndex = rows.findIndex(row => row.some(value => String(value ?? '').trim()))
  if (headerRowIndex < 0) throw new Error('建筑碳排配置工作表没有表头')
  const headers = rows[headerRowIndex].map(normalizedHeader)
  const categoryIndex = headers.indexOf('类别')
  const nameIndex = headers.indexOf('名称')
  const factorIndex = headers.findIndex(header => header === '碳排因子' || header === '碳排放因子')
  const unitIndex = headers.indexOf('材料单位')
  const recyclingFactorIndex = headers.indexOf('回收因子')
  const recyclingCoefficientIndex = headers.indexOf('回收系数')
  if ([categoryIndex, nameIndex, factorIndex, unitIndex].some(index => index < 0)) {
    throw new Error('建筑碳排配置表必须包含“类别”“名称”“碳排因子”“材料单位”列')
  }

  const configurations: BuildCarbonConfigInfo[] = []
  for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex]
    const category = String(row[categoryIndex] ?? '').trim()
    const name = String(row[nameIndex] ?? '').trim()
    const materialUnit = String(row[unitIndex] ?? '').trim()
    const factorText = String(row[factorIndex] ?? '').trim()
    const recyclingFactorText = recyclingFactorIndex < 0 ? '' : String(row[recyclingFactorIndex] ?? '').trim()
    const recyclingCoefficientText = recyclingCoefficientIndex < 0 ? '' : String(row[recyclingCoefficientIndex] ?? '').trim()
    if (![category, name, materialUnit, factorText, recyclingFactorText, recyclingCoefficientText].some(Boolean)) {
      continue
    }
    if (!category || !name || !materialUnit || !factorText) {
      throw new Error(`建筑碳排配置第 ${rowIndex + 1} 行缺少类别、名称、碳排因子或材料单位`)
    }

    configurations.push(new BuildCarbonConfigInfo({
      category,
      name,
      emissionFactor: numericValue(factorText, '碳排因子', rowIndex + 1),
      materialUnit,
      recyclingFactor: numericValue(recyclingFactorText, '回收因子', rowIndex + 1, true),
      recyclingCoefficient: numericValue(recyclingCoefficientText, '回收系数', rowIndex + 1, true)
    }))
  }
  return configurations
}

export const buildCarbonConfigInfoList = new BuildCarbonConfigInfoList()
