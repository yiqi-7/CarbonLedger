import { constructionEnergyTypes } from '../data/constructionMaterialInfo.js'
import { parseNumericCell, resolveSheetRows } from './excelSheetLookup.js'

const MAX_FILE_SIZE = 20 * 1024 * 1024

const preferredSheetNames = ['施工碳排放量', '工程台班清单']

const headerAliases = {
  machineryName: ['机械名称', '设备名称', '机械'],
  shiftCount: ['台班数', '台班数量', '台班'],
  energyType: ['能源类型', '能源'],
  energyPerShift: ['单位台班能耗', '台班能耗', '单位能耗'],
  emissionFactor: ['碳排放因子', '碳排因子', '排放因子'],
  shiftUnitPrice: ['台班单价', '单价', '台班价格']
}

const emptyPlaceholders = ['', '-', '—', '–', '/', '无', '暂无']

function normalizeHeader(value) {
  return String(value ?? '').trim().replace(/\s/g, '').replace(/[（(].*?[）)]/g, '')
}

function findColumn(headers, aliases) {
  return headers.findIndex(header => aliases.includes(header))
}

function hasConstructionHeaderRow(rows) {
  return rows.some(row => {
    const headers = row.map(normalizeHeader)
    return findColumn(headers, headerAliases.machineryName) >= 0 &&
      findColumn(headers, headerAliases.shiftCount) >= 0
  })
}

export function parseConstructionMaterialExcel(workbookBytes) {
  if (!(workbookBytes instanceof Uint8Array) || workbookBytes.byteLength === 0) {
    throw new Error('请选择有效的Excel文件')
  }
  if (workbookBytes.byteLength > MAX_FILE_SIZE) {
    throw new Error('Excel文件不能超过20MB')
  }

  const rows = resolveSheetRows(workbookBytes, preferredSheetNames, hasConstructionHeaderRow)
  if (!rows) {
    throw new Error('Excel文件中没有找到工程台班工作表（需包含“机械名称”“台班数”列）')
  }

  const headerRowIndex = rows.findIndex(row => {
    const headers = row.map(normalizeHeader)
    return findColumn(headers, headerAliases.machineryName) >= 0 &&
      findColumn(headers, headerAliases.shiftCount) >= 0
  })
  const headers = rows[headerRowIndex].map(normalizeHeader)
  const indexes = {}
  for (const [field, aliases] of Object.entries(headerAliases)) {
    indexes[field] = findColumn(headers, aliases)
  }
  // 碳排放因子可从能源类型推导，因此允许表格中没有该列。
  for (const field of ['machineryName', 'shiftCount', 'energyType', 'energyPerShift', 'shiftUnitPrice']) {
    if (indexes[field] < 0) {
      const label = {
        machineryName: '机械名称',
        shiftCount: '台班数',
        energyType: '能源类型',
        energyPerShift: '单位台班能耗',
        shiftUnitPrice: '台班单价'
      }[field]
      throw new Error(`工程台班清单缺少“${label}”列`)
    }
  }

  const materials = []
  let skippedRows = 0
  for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex]
    if (!row || row.every(value => String(value ?? '').trim() === '')) continue

    const valueFor = field => (indexes[field] < 0 ? '' : String(row[indexes[field]] ?? '').trim())
    const machineryName = valueFor('machineryName')
    const shiftCountText = valueFor('shiftCount')
    const energyType = valueFor('energyType')
    const energyPerShiftText = valueFor('energyPerShift')
    const emissionFactorText = valueFor('emissionFactor')
    const shiftUnitPriceText = valueFor('shiftUnitPrice')
    if (![machineryName, shiftCountText, energyType, energyPerShiftText, shiftUnitPriceText].every(Boolean)) {
      skippedRows += 1
      continue
    }

    const energy = constructionEnergyTypes[energyType]
    const shiftCount = parseNumericCell(shiftCountText)
    const energyPerShift = parseNumericCell(energyPerShiftText)
    const shiftUnitPrice = parseNumericCell(shiftUnitPriceText)
    const emissionFactor = emptyPlaceholders.includes(emissionFactorText)
      ? energy?.emissionFactor
      : parseNumericCell(emissionFactorText)
    if (!energy ||
      !Number.isSafeInteger(shiftCount) || shiftCount <= 0 ||
      energyPerShift === null || energyPerShift <= 0 ||
      emissionFactor === null || emissionFactor < 0 ||
      shiftUnitPrice === null || shiftUnitPrice < 0) {
      throw new Error(`第 ${rowIndex + 1} 行工程台班数据无效（请检查台班数、单位台班能耗、能源类型与台班单价）`)
    }

    materials.push({
      machineryName,
      shiftCount,
      energyType,
      energyPerShift,
      emissionFactor,
      shiftUnitPrice
    })
  }

  return { materials, skippedRows }
}
