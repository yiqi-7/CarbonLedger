import { strFromU8, unzipSync } from 'fflate'
import configWorkbookUrl from '../config/配置文件.xlsx?inline'

const spreadsheetNamespace = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const relationshipsNamespace = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const packageRelationshipsNamespace = 'http://schemas.openxmlformats.org/package/2006/relationships'

type WorkbookFiles = Record<string, Uint8Array>
type WorkbookRows = string[][]

export interface TransportCarbonConfigInfoInput {
  vehicleName: string
  energyType: string
  emissionFactor: number
}

export class TransportCarbonConfigInfo {
  vehicleName: string
  energyType: string
  emissionFactor: number

  constructor({ vehicleName, energyType, emissionFactor }: TransportCarbonConfigInfoInput) {
    this.vehicleName = vehicleName
    this.energyType = energyType
    this.emissionFactor = emissionFactor
  }
}

class TransportCarbonConfigNode {
  config: TransportCarbonConfigInfo
  next: TransportCarbonConfigNode | null

  constructor(config: TransportCarbonConfigInfo) {
    this.config = config
    this.next = null
  }
}

export class TransportCarbonConfigInfoList {
  head: TransportCarbonConfigNode | null
  count: number

  constructor(configurations: TransportCarbonConfigInfo[] = []) {
    this.head = null
    this.count = 0
    configurations.forEach(configuration => this.append(configuration))
  }

  append(configuration: TransportCarbonConfigInfo): TransportCarbonConfigInfo {
    const node = new TransportCarbonConfigNode(configuration)
    if (!this.head) {
      this.head = node
    } else {
      let current = this.head
      while (current.next) current = current.next
      current.next = node
    }
    this.count += 1
    return node.config
  }

  replaceAll(configurations: TransportCarbonConfigInfo[]): void {
    this.head = null
    this.count = 0
    configurations.forEach(configuration => this.append(configuration))
  }

  toArray(): TransportCarbonConfigInfo[] {
    const configurations: TransportCarbonConfigInfo[] = []
    let current = this.head
    while (current) {
      configurations.push(current.config)
      current = current.next
    }
    return configurations
  }

  findByVehicleName(vehicleName: string): TransportCarbonConfigInfo | null {
    let current = this.head
    while (current) {
      if (current.config.vehicleName === vehicleName) return current.config
      current = current.next
    }
    return null
  }
}

function parseXml(content: string, description: string): XMLDocument {
  const document = new DOMParser().parseFromString(content, 'application/xml')
  if (document.querySelector('parsererror')) throw new Error(`运输配置文件${description}格式无效`)
  return document
}

function readXml(files: WorkbookFiles, path: string, description: string): XMLDocument {
  const content = files[path]
  if (!content) throw new Error(`运输配置文件缺少${description}`)
  return parseXml(strFromU8(content), description)
}

function normalizeWorkbookPath(target: string): string {
  const parts: string[] = []
  for (const part of target.replace(/\\/g, '/').split('/')) {
    if (!part || part === '.') continue
    if (part === '..') parts.pop()
    else parts.push(part)
  }
  return parts[0] === 'xl' ? parts.join('/') : `xl/${parts.join('/')}`
}

function columnIndex(reference: string): number {
  const letters = reference.match(/^[A-Z]+/i)?.[0]
  if (!letters) throw new Error(`运输配置文件单元格地址无效：${reference}`)
  let index = 0
  for (const letter of letters.toUpperCase()) {
    index = index * 26 + letter.charCodeAt(0) - 64
  }
  return index - 1
}

function decodeWorkbookUrl(url: string): Uint8Array {
  const match = url.match(/^data:[^,]*;base64,(.+)$/)
  if (!match) throw new Error('运输配置文件未以内嵌方式加载')
  const binary = atob(match[1])
  return Uint8Array.from(binary, character => character.charCodeAt(0))
}

function readCell(cell: Element, sharedStrings: string[]): string {
  const type = cell.getAttribute('t')
  if (type === 'inlineStr') {
    return cell.getElementsByTagNameNS(spreadsheetNamespace, 'is')[0]?.textContent ?? ''
  }

  const value = cell.getElementsByTagNameNS(spreadsheetNamespace, 'v')[0]?.textContent ?? ''
  if (type === 's') {
    const sharedString = sharedStrings[Number(value)]
    if (sharedString === undefined) throw new Error('运输配置文件共享字符串索引无效')
    return sharedString
  }
  return value
}

export function listWorkbookSheetNames(workbookBytes: Uint8Array): string[] {
  const coreFiles = unzipSync(workbookBytes, {
    filter: file => file.name === 'xl/workbook.xml'
  })
  const workbook = readXml(coreFiles, 'xl/workbook.xml', '工作簿信息')
  return Array.from(
    workbook.getElementsByTagNameNS(spreadsheetNamespace, 'sheet'),
    sheet => sheet.getAttribute('name') ?? ''
  ).filter(Boolean)
}

export function readWorkbookSheetRows(workbookBytes: Uint8Array, sheetName: string): WorkbookRows | null {
  const coreFiles = unzipSync(workbookBytes, {
    filter: file => file.name === 'xl/workbook.xml' || file.name === 'xl/_rels/workbook.xml.rels'
  })
  const workbook = readXml(coreFiles, 'xl/workbook.xml', '工作簿信息')
  const relationships = readXml(coreFiles, 'xl/_rels/workbook.xml.rels', '工作表关联信息')
  const sheet = Array.from(workbook.getElementsByTagNameNS(spreadsheetNamespace, 'sheet'))
    .find(candidate => candidate.getAttribute('name') === sheetName)
  if (!sheet) return null

  const relationshipId = sheet.getAttributeNS(relationshipsNamespace, 'id')
  const relationship = Array.from(relationships.getElementsByTagNameNS(packageRelationshipsNamespace, 'Relationship'))
    .find(candidate => candidate.getAttribute('Id') === relationshipId)
  if (!relationship?.getAttribute('Target')) throw new Error(`无法读取“${sheetName}”工作表`)

  const target = relationship.getAttribute('Target')
  if (!target) throw new Error(`无法读取“${sheetName}”工作表`)
  const worksheetPath = normalizeWorkbookPath(target)
  const contentFiles = unzipSync(workbookBytes, {
    filter: file => file.name === worksheetPath || file.name === 'xl/sharedStrings.xml'
  })
  const worksheet = readXml(contentFiles, worksheetPath, `${sheetName}工作表`)
  const sharedStringsDocument = contentFiles['xl/sharedStrings.xml']
    ? parseXml(strFromU8(contentFiles['xl/sharedStrings.xml']), '共享字符串')
    : null
  const sharedStrings = sharedStringsDocument
    ? Array.from(
      sharedStringsDocument.getElementsByTagNameNS(spreadsheetNamespace, 'si'),
      item => item.textContent ?? ''
    )
    : []
  return Array.from(worksheet.getElementsByTagNameNS(spreadsheetNamespace, 'row'), row => {
    const values: string[] = []
    for (const cell of row.getElementsByTagNameNS(spreadsheetNamespace, 'c')) {
      const reference = cell.getAttribute('r')
      if (!reference) throw new Error(`${sheetName}工作表中有缺少地址的单元格`)
      values[columnIndex(reference)] = readCell(cell, sharedStrings)
    }
    return values
  })
}

export function parseTransportCarbonConfigWorkbook(workbookBytes: Uint8Array): TransportCarbonConfigInfo[] {
  const rows = readWorkbookSheetRows(workbookBytes, '运输碳排配置')
  if (!rows) throw new Error('运输配置文件中没有“运输碳排配置”工作表')
  const headerRowIndex = rows.findIndex(row => row.some(value => String(value ?? '').trim()))
  if (headerRowIndex < 0) throw new Error('运输碳排配置工作表没有表头')

  const headers = rows[headerRowIndex].map(value => String(value ?? '').trim().replace(/\s/g, ''))
  const nameIndex = headers.indexOf('名称')
  const energyTypeIndex = headers.indexOf('能源类型')
  const factorIndex = headers.findIndex(value => value.startsWith('因子'))
  if (nameIndex < 0 || energyTypeIndex < 0 || factorIndex < 0) {
    throw new Error('运输碳排配置表必须包含“名称”“能源类型”“因子”三列')
  }

  const configurations: TransportCarbonConfigInfo[] = []
  for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex]
    const vehicleName = String(row[nameIndex] ?? '').trim()
    const energyType = String(row[energyTypeIndex] ?? '').trim()
    const factorValue = String(row[factorIndex] ?? '').trim()
    if (!vehicleName && !energyType && !factorValue) continue
    const emissionFactor = Number(factorValue)
    if (!vehicleName || !['柴油', '汽油'].includes(energyType) ||
      !Number.isFinite(emissionFactor) || emissionFactor <= 0) {
      throw new Error(`运输碳排配置第 ${rowIndex + 1} 行数据无效`)
    }
    configurations.push(new TransportCarbonConfigInfo({ vehicleName, energyType, emissionFactor }))
  }
  if (configurations.length === 0) throw new Error('运输碳排配置表中没有有效配置')
  return configurations
}

export const configurationWorkbookBytes = decodeWorkbookUrl(configWorkbookUrl)

export const transportCarbonConfigInfoList = new TransportCarbonConfigInfoList(
  parseTransportCarbonConfigWorkbook(configurationWorkbookBytes)
)
