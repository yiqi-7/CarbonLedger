import { parseNumericCell, resolveSheetRows } from './excelSheetLookup.js'

const MAX_FILE_SIZE = 20 * 1024 * 1024

const defaultUnits = {
  混凝土: 'm³',
  金属: 't',
  钢材: 't',
  砌体: '㎡',
  保温材料: 'm³',
  '水泥及砂浆': 't',
  玻璃: 'm²',
  其他: 't'
}

const preferredSheetNames = ['建材生产碳排放量', '材料清单']

const headerAliases = {
  materialName: ['材料名称', '名称'],
  type: ['类型', '材料类别', '类别'],
  quantity: ['用量', '使用量'],
  unit: ['单位', '材料单位'],
  emissionFactor: ['碳排因子', '碳排放因子', '碳排放系数'],
  marketPrice: ['市场价', '市场价格'],
  unitPrice: ['单价', '成交价'],
  recyclingFactor: ['回收因子'],
  recyclingCoefficient: ['回收系数', '回收率', '再生系数', '可回收系数']
}

function normalizeHeader(value) {
  return String(value ?? '').trim().replace(/\s/g, '').replace(/[（(].*?[）)]/g, '')
}

function findColumn(headers, aliases) {
  return headers.findIndex(header => aliases.includes(header))
}

function emptyPlaceholders() {
  return ['', '-', '—', '–', '/', '无', '暂无']
}

function hasMaterialHeaderRow(rows) {
  return rows.some(row => {
    const headers = row.map(normalizeHeader)
    return findColumn(headers, headerAliases.materialName) >= 0 &&
      findColumn(headers, headerAliases.quantity) >= 0
  })
}

function parseMaterials(rows, sheetName) {
  const headerIndex = rows.findIndex(row => {
    const headers = row.map(normalizeHeader)
    return findColumn(headers, headerAliases.materialName) >= 0 &&
      findColumn(headers, headerAliases.quantity) >= 0
  })
  if (headerIndex < 0) throw new Error(`${sheetName}工作表中没有有效的材料清单表头`)

  const headers = rows[headerIndex].map(normalizeHeader)
  const indexes = {}
  for (const [field, aliases] of Object.entries(headerAliases)) {
    indexes[field] = findColumn(headers, aliases)
  }
  for (const field of ['materialName', 'quantity', 'emissionFactor', 'unitPrice']) {
    if (indexes[field] < 0) {
      const label = {
        materialName: '材料名称',
        quantity: '用量',
        emissionFactor: '碳排放因子',
        unitPrice: '单价/成交价'
      }[field]
      throw new Error(`${sheetName}工作表缺少“${label}”列`)
    }
  }

  const materials = []
  for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex]
    if (!row || row.every(value => String(value ?? '').trim() === '')) continue
    const valueFor = field => (indexes[field] < 0 ? '' : String(row[indexes[field]] ?? '').trim())
    const materialName = valueFor('materialName')
    // 类型允许为空：后续会按“建筑碳排配置”中的同名条目补全类别与单位。
    const type = valueFor('type')
    const quantityText = valueFor('quantity')
    const emissionFactorText = valueFor('emissionFactor')
    const marketPriceText = valueFor('marketPrice')
    const unitPriceText = valueFor('unitPrice')
    const recyclingFactorText = valueFor('recyclingFactor')
    const recyclingCoefficientText = valueFor('recyclingCoefficient')
    const unit = valueFor('unit')

    if (!materialName || !quantityText || !emissionFactorText || !unitPriceText) {
      const missing = [
        [materialName, '材料名称'],
        [quantityText, '用量'],
        [emissionFactorText, '碳排放因子'],
        [unitPriceText, '单价']
      ].filter(([value]) => !value).map(([, label]) => label)
      throw new Error(`第 ${rowIndex + 1} 行的${missing.join('、')}不能为空`)
    }

    const quantity = parseNumericCell(quantityText)
    const emissionFactor = parseNumericCell(emissionFactorText)
    const unitPrice = parseNumericCell(unitPriceText)
    const marketPrice = emptyPlaceholders().includes(marketPriceText)
      ? null
      : parseNumericCell(marketPriceText)
    const recyclingFactor = emptyPlaceholders().includes(recyclingFactorText)
      ? 0
      : parseNumericCell(recyclingFactorText) ?? 0
    const recyclingCoefficient = emptyPlaceholders().includes(recyclingCoefficientText)
      ? 0
      : parseNumericCell(recyclingCoefficientText) ?? 0
    if (quantity === null || quantity <= 0 ||
      emissionFactor === null || emissionFactor < 0 ||
      (marketPrice !== null && marketPrice < 0) ||
      unitPrice === null || unitPrice < 0 ||
      recyclingFactor < 0 || recyclingCoefficient < 0) {
      throw new Error(`第 ${rowIndex + 1} 行用量、碳排放因子、单价、回收因子或回收系数无效`)
    }
    materials.push({
      materialName,
      type,
      quantity,
      unit: unit || defaultUnits[type] || '',
      emissionFactor,
      marketPrice,
      unitPrice,
      recyclingFactor,
      recyclingCoefficient,
      isParticipatingInRecyclingCalculation: recyclingFactor > 0
    })
  }

  return { materials }
}

export function parseBuildMaterialExcel(data) {
  if (!(data instanceof Uint8Array) || data.byteLength === 0) {
    throw new Error('请选择有效的Excel文件')
  }
  if (data.byteLength > MAX_FILE_SIZE) {
    throw new Error('Excel文件不能超过20MB')
  }

  const rows = resolveSheetRows(data, preferredSheetNames, hasMaterialHeaderRow)
  if (!rows) {
    throw new Error('Excel文件中没有找到材料清单工作表（需包含“材料名称”“用量”列）')
  }
  return parseMaterials(rows, '材料清单')
}
