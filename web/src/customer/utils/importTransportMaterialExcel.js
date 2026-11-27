import { transportEnergyTypes } from '../data/transportMaterialInfo.ts'
import { parseNumericCell, resolveSheetRows } from './excelSheetLookup.js'

const MAX_FILE_SIZE = 20 * 1024 * 1024

const preferredSheetNames = ['运输碳排放量', '运输记录清单', '运输记录']

const headerAliases = {
  vehicleName: ['车辆名称', '车辆', '车型'],
  transportedMaterial: ['运输货物', '货物', '货物名称'],
  transportQuantity: ['运输量', '重量', '载重量'],
  transportDistance: ['运距', '运输距离', '远距', '距离'],
  energyType: ['能源类型', '能源'],
  emissionFactor: ['碳排放因子', '碳排因子', '排放因子', '运输因子'],
  transportUnitPrice: ['运输单价', '运输价', '单价']
}

function normalizeHeader(value) {
  return String(value ?? '').trim().replace(/\s/g, '').replace(/[（(].*?[）)]/g, '')
}

function findColumnIndex(headers, acceptedHeaders) {
  const exactIndex = headers.findIndex(header => acceptedHeaders.includes(header))
  if (exactIndex >= 0) return exactIndex
  return headers.findIndex(header =>
    acceptedHeaders.some(acceptedHeader => header.includes(acceptedHeader))
  )
}

function requiredColumnIndex(headers, acceptedHeaders, columnName) {
  const index = findColumnIndex(headers, acceptedHeaders)
  if (index < 0) {
    throw new Error(`运输记录清单缺少“${columnName}”列`)
  }
  return index
}

function hasTransportHeaderRow(rows) {
  return rows.some(row => {
    const headers = row.map(normalizeHeader)
    return findColumnIndex(headers, headerAliases.vehicleName) >= 0 &&
      findColumnIndex(headers, headerAliases.transportQuantity) >= 0
  })
}

export function parseTransportMaterialExcel(workbookBytes) {
  if (!(workbookBytes instanceof Uint8Array) || workbookBytes.byteLength === 0) {
    throw new Error('请选择有效的Excel文件')
  }
  if (workbookBytes.byteLength > MAX_FILE_SIZE) {
    throw new Error('Excel文件不能超过20MB')
  }

  const rows = resolveSheetRows(workbookBytes, preferredSheetNames, hasTransportHeaderRow)
  if (!rows) {
    throw new Error('Excel文件中没有找到运输记录工作表（需包含“车辆”“运输量”列）')
  }

  const headerRowIndex = rows.findIndex(row => {
    const headers = row.map(normalizeHeader)
    return findColumnIndex(headers, headerAliases.vehicleName) >= 0 &&
      findColumnIndex(headers, headerAliases.transportQuantity) >= 0
  })
  const headers = rows[headerRowIndex].map(normalizeHeader)
  const indexes = {
    vehicleName: requiredColumnIndex(headers, headerAliases.vehicleName, '车辆名称'),
    transportedMaterial: requiredColumnIndex(headers, headerAliases.transportedMaterial, '运输货物'),
    transportQuantity: requiredColumnIndex(headers, headerAliases.transportQuantity, '运输量'),
    transportDistance: requiredColumnIndex(headers, headerAliases.transportDistance, '运距'),
    energyType: requiredColumnIndex(headers, headerAliases.energyType, '能源类型'),
    emissionFactor: requiredColumnIndex(headers, headerAliases.emissionFactor, '碳排放因子'),
    transportUnitPrice: requiredColumnIndex(headers, headerAliases.transportUnitPrice, '运输单价')
  }
  const unitPriceInTenThousands =
    /万元/.test(String(rows[headerRowIndex][indexes.transportUnitPrice] ?? ''))

  const materials = []
  let skippedRows = 0
  for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex]
    if (!row || row.every(value => String(value ?? '').trim() === '')) continue

    const valueFor = field => String(row[indexes[field]] ?? '').trim()
    const vehicleName = valueFor('vehicleName')
    const transportedMaterial = valueFor('transportedMaterial')
    const quantityText = valueFor('transportQuantity')
    const distanceText = valueFor('transportDistance')
    const energyType = valueFor('energyType')
    const factorText = valueFor('emissionFactor')
    const priceText = valueFor('transportUnitPrice')
    if (![vehicleName, quantityText, distanceText, energyType, factorText, priceText].every(Boolean)) {
      skippedRows += 1
      continue
    }

    const transportQuantity = parseNumericCell(quantityText)
    const transportDistance = parseNumericCell(distanceText)
    const emissionFactor = parseNumericCell(factorText)
    const unitPrice = parseNumericCell(priceText)
    if (!transportEnergyTypes.includes(energyType) ||
      transportQuantity === null || transportQuantity <= 0 ||
      transportDistance === null || transportDistance <= 0 ||
      emissionFactor === null || emissionFactor <= 0 ||
      unitPrice === null || unitPrice < 0) {
      throw new Error(`第 ${rowIndex + 1} 行运输记录数值或能源类型无效（能源类型仅支持柴油、汽油）`)
    }

    materials.push({
      vehicleName,
      transportedMaterial,
      transportQuantity,
      transportDistance,
      energyType,
      emissionFactor,
      transportUnitPrice: unitPrice * (unitPriceInTenThousands ? 10000 : 1)
    })
  }

  return { materials, skippedRows }
}
