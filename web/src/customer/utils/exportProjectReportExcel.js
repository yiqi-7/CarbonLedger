import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function readAttribute(attributes, name) {
  return attributes.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`))?.[1] ?? null
}

function columnIndex(columnName) {
  return [...columnName].reduce((index, character) =>
    index * 26 + character.charCodeAt(0) - 64, 0)
}

function columnName(index) {
  let name = ''
  while (index > 0) {
    const remainder = (index - 1) % 26
    name = String.fromCharCode(65 + remainder) + name
    index = Math.floor((index - 1) / 26)
  }
  return name
}

function cellReferenceParts(reference) {
  const match = reference.match(/^([A-Z]+)(\d+)$/)
  if (!match) throw new Error(`报告书模板中包含无效单元格地址：${reference}`)
  return { column: match[1], row: Number(match[2]) }
}

function shiftReference(reference, startColumn) {
  return reference.replace(/(\$?)([A-Z]+)(\$?\d+)/g, (match, absolute, letters, row) => {
    const index = columnIndex(letters)
    return `${absolute}${columnName(index >= startColumn ? index + 1 : index)}${row}`
  })
}

function templateSheetPaths(files) {
  const workbookText = strFromU8(files['xl/workbook.xml'])
  const relationshipsText = strFromU8(files['xl/_rels/workbook.xml.rels'])
  const relationships = new Map()
  for (const [, attributes] of relationshipsText.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    relationships.set(readAttribute(attributes, 'Id'), readAttribute(attributes, 'Target'))
  }

  const paths = new Map()
  for (const [, attributes] of workbookText.matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const name = readAttribute(attributes, 'name')
    const relationshipId = readAttribute(attributes, 'r:id')
    const target = relationships.get(relationshipId)
    if (!name || !target) throw new Error('无法读取报告书模板中的工作表关联信息')
    const path = target.startsWith('/') ? target.slice(1) : `xl/${target}`
    if (!files[path]) throw new Error(`报告书模板缺少工作表文件：${name}`)
    paths.set(name, path)
  }
  return paths
}

function parseRow(rowXml) {
  const opening = rowXml.match(/^<row\b([^>]*)>/)
  const closingIndex = rowXml.lastIndexOf('</row>')
  if (!opening || closingIndex < 0) throw new Error('报告书模板中存在无效的工作表行')
  const cells = new Map()
  const body = rowXml.slice(opening[0].length, closingIndex)
  let remainder = body
  for (const cellMatch of body.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const attributes = cellMatch[1]
    const reference = readAttribute(attributes, 'r')
    if (!reference) continue
    const { column } = cellReferenceParts(reference)
    cells.set(columnIndex(column), { reference, attributes, xml: cellMatch[0] })
    remainder = remainder.replace(cellMatch[0], '')
  }
  return { attributes: opening[1], cells, remainder }
}

function renderCell(reference, value, originalAttributes = '') {
  const attributes = originalAttributes
    .replace(/\s+r="[^"]*"/, '')
    .replace(/\s+t="[^"]*"/, '')
  const cellOpen = `<c r="${reference}"${attributes ? ` ${attributes.trim()}` : ''}`
  if (value === null || value === undefined || value === '') return `${cellOpen}/>`
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`报告书中不能写入无效数值：${reference}`)
    return `${cellOpen}><v>${Number(value.toPrecision(15))}</v></c>`
  }
  return `${cellOpen} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`
}

function styleAttributesByColumn(rowXml) {
  if (!rowXml) return new Map()
  const { cells } = parseRow(rowXml)
  return new Map([...cells].map(([index, cell]) => [
    index,
    cell.attributes
      .replace(/\s+r="[^"]*"/, '')
      .replace(/\s+t="[^"]*"/, '')
  ]))
}

function renderRow(attributes, cells, remainder) {
  const orderedCells = [...cells.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, cell]) => cell.xml)
    .join('')
  return `<row${attributes ? ` ${attributes.trim()}` : ''}>${orderedCells}${remainder}</row>`
}

function updateRow(rowXml, rowNumber, values, styles) {
  const row = parseRow(rowXml)
  row.attributes = row.attributes.replace(/\br="\d+"/, `r="${rowNumber}"`)
  const rowStyleMap = new Map([...row.cells].map(([index, cell]) => [index, cell.attributes]))
  for (const [reference, value] of Object.entries(values)) {
    const { column } = cellReferenceParts(reference)
    const index = columnIndex(column)
    const originalAttributes = rowStyleMap.get(index) ?? styles.get(index) ?? ''
    row.cells.set(index, {
      reference,
      attributes: `r="${reference}"${originalAttributes}`,
      xml: renderCell(reference, value, originalAttributes)
    })
  }
  return renderRow(row.attributes, row.cells, row.remainder)
}

function getRowXml(sheetXml, rowNumber) {
  return [...sheetXml.matchAll(/<row\b[^>]*\br="(\d+)"[^>]*>[\s\S]*?<\/row>/g)]
    .find(([, number]) => Number(number) === rowNumber)?.[0] ?? null
}

function insertRow(sheetXml, rowXml) {
  const rowNumber = Number(rowXml.match(/<row\b[^>]*\br="(\d+)"/)?.[1])
  const rowNumbers = [...sheetXml.matchAll(/<row\b[^>]*\br="(\d+)"/g)].map(([, number]) => Number(number))
  const nextRow = rowNumbers.find(number => number > rowNumber)
  if (nextRow !== undefined) {
    const nextRowPattern = new RegExp(`<row\\b(?=[^>]*\\br="${nextRow}")[^>]*>[\\s\\S]*?<\\/row>`)
    return sheetXml.replace(nextRowPattern, `${rowXml}$&`)
  }
  return sheetXml.replace('</sheetData>', `${rowXml}</sheetData>`)
}

function setWorksheetRow(sheetXml, rowNumber, values, baseRowXml) {
  const existingRow = getRowXml(sheetXml, rowNumber)
  if (!existingRow && !baseRowXml) throw new Error(`报告书模板缺少第 ${rowNumber} 行格式`)
  const styleRow = existingRow ?? baseRowXml
  const styles = styleAttributesByColumn(styleRow)
  const rowToUpdate = existingRow ?? baseRowXml
    .replace(/(<row\b[^>]*\br=")\d+(")/, `$1${rowNumber}$2`)
    .replace(/(<c\b[^>]*\br="[A-Z]+)\d+(")/g, `$1${rowNumber}$2`)
  let updatedRow = updateRow(rowToUpdate, rowNumber, values, styles)
  if (existingRow) {
    return sheetXml.replace(existingRow, updatedRow)
  }
  updatedRow = updatedRow.replace(/<row\b([^>]*)>/, (_match, attributes) => {
    const withSpans = attributes.includes('spans="')
      ? attributes.replace(/spans="(\d+):(\d+)"/, (_span, first, last) =>
        `spans="${first}:${Math.max(Number(last), ...Object.keys(values).map(reference => columnIndex(cellReferenceParts(reference).column)))}"`)
      : attributes
    return `<row${withSpans ? ` ${withSpans.trim()}` : ''}>`
  })
  return insertRow(sheetXml, updatedRow)
}

function setWorksheetCells(sheetXml, values, baseRowNumber = 1) {
  const groupedValues = new Map()
  for (const [reference, value] of Object.entries(values)) {
    const { row } = cellReferenceParts(reference)
    if (!groupedValues.has(row)) groupedValues.set(row, {})
    groupedValues.get(row)[reference] = value
  }
  for (const [rowNumber, rowValues] of groupedValues) {
    sheetXml = setWorksheetRow(
      sheetXml,
      rowNumber,
      rowValues,
      getRowXml(sheetXml, baseRowNumber)
    )
  }
  return sheetXml
}

function updateDimension(sheetXml) {
  const references = [...sheetXml.matchAll(/<c\b[^>]*\br="([A-Z]+)(\d+)"/g)]
  const maxColumn = Math.max(1, ...references.map(([, column]) => columnIndex(column)))
  const maxRow = Math.max(1, ...references.map(([, , row]) => Number(row)))
  return sheetXml.replace(/<dimension\b([^>]*\bref=")([^"]+)"/, (_match, prefix, reference) => {
    const minimum = reference.match(/^([A-Z]+\d+):/)?.[1] ?? 'A1'
    return `<dimension${prefix}${minimum}:${columnName(maxColumn)}${maxRow}"`
  })
}

function updatePrintAreas(workbookXml, sheetPaths, files) {
  const sheetNames = [...sheetPaths.keys()]
  return workbookXml.replace(
    /<definedName\b([^>]*\bname="_xlnm\.Print_Area"[^>]*)>([\s\S]*?)<\/definedName>/g,
    (whole, attributes, currentRange) => {
      const sheetIndex = Number(readAttribute(attributes, 'localSheetId'))
      const sheetName = sheetNames[sheetIndex]
      const sheetPath = sheetPaths.get(sheetName)
      if (!sheetPath) return whole
      const sheetXml = strFromU8(files[sheetPath])
      const dimension = sheetXml.match(/<dimension\b[^>]*\bref="A1:([A-Z]+)(\d+)"/)
      if (!dimension) return whole
      const sheetPrefix = currentRange.split('!')[0]
      return `<definedName${attributes}>${sheetPrefix}!$A$1:$${dimension[1]}$${dimension[2]}</definedName>`
    }
  )
}

async function imageAssetFromProjectInfo(projectInfo) {
  const image = projectInfo.modelImage
  if (!image) return null

  let blob
  if (image instanceof Blob) {
    blob = image
  } else if (typeof image === 'string') {
    const match = image.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/)
    if (!match) throw new Error('项目模型图片格式无效，无法写入报告书')
    const binary = atob(match[2])
    blob = new Blob(
      [Uint8Array.from(binary, character => character.charCodeAt(0))],
      { type: match[1] }
    )
  } else {
    throw new Error('项目模型图片数据无法读取')
  }

  if (blob.type === 'image/webp') {
    const bitmap = await createImageBitmap(blob)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      const context = canvas.getContext('2d')
      if (!context) throw new Error('无法处理项目模型图片')
      context.drawImage(bitmap, 0, 0)
      blob = await new Promise((resolve, reject) => {
        canvas.toBlob(result => {
          if (result) resolve(result)
          else reject(new Error('无法将项目模型图片转换为报告书格式'))
        }, 'image/png')
      })
    } finally {
      bitmap.close()
    }
  }

  if (!['image/png', 'image/jpeg'].includes(blob.type)) {
    throw new Error('项目模型图片仅支持 PNG、JPG 或 WEBP 格式')
  }
  const bytes = new Uint8Array(await blob.arrayBuffer())
  return {
    bytes,
    extension: blob.type === 'image/jpeg' ? 'jpeg' : 'png',
    contentType: blob.type
  }
}

function addProjectImage(files, sheetPath, imageAsset) {
  const relationshipsPath = sheetPath.replace(
    /^xl\/worksheets\/([^/]+)\.xml$/,
    'xl/worksheets/_rels/$1.xml.rels'
  )
  const drawingPath = 'xl/drawings/drawing1.xml'
  const drawingRelationshipsPath = 'xl/drawings/_rels/drawing1.xml.rels'
  const imagePath = `xl/media/image1.${imageAsset.extension}`
  const worksheet = strFromU8(files[sheetPath])
    .replace(/<row\b([^>]*\br="6"[^>]*)>/, (_match, attributes) =>
      `<row${attributes.replace(/\bht="[^"]*"/, 'ht="140"').replace(/\s*$/, '')}>`)
    .replace('</worksheet>', '<drawing r:id="rId1"/></worksheet>')
  files[sheetPath] = strToU8(worksheet)
  files[relationshipsPath] = strToU8(
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>' +
    '</Relationships>'
  )
  files[drawingPath] = strToU8(
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>1</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>5</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>' +
    '<xdr:to><xdr:col>5</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>6</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>' +
    '<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="2" name="项目模型图片"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>' +
    '<xdr:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>' +
    '<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic>' +
    '<xdr:clientData/></xdr:twoCellAnchor></xdr:wsDr>'
  )
  files[drawingRelationshipsPath] = strToU8(
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.${imageAsset.extension}"/>` +
    '</Relationships>'
  )
  files[imagePath] = imageAsset.bytes

  const contentTypes = strFromU8(files['[Content_Types].xml'])
  const extension = imageAsset.extension
  const defaultImageType = `<Default Extension="${extension}" ContentType="${imageAsset.contentType}"/>`
  const drawingOverride = '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>'
  files['[Content_Types].xml'] = strToU8(
    contentTypes.replace('</Types>', `${defaultImageType}${drawingOverride}</Types>`)
  )
}

function shiftWorksheetColumns(sheetXml, startColumn) {
  let shifted = sheetXml.replace(/(<c\b[^>]*\br=")([A-Z]+)(\d+)"/g, (_match, prefix, column, row) => {
    const index = columnIndex(column)
    return `${prefix}${columnName(index >= startColumn ? index + 1 : index)}${row}"`
  })
  shifted = shifted.replace(/(<mergeCell\b[^>]*\bref=")([^"]+)"/g, (_match, prefix, reference) =>
    `${prefix}${shiftReference(reference, startColumn)}"`)
  shifted = shifted.replace(/(<dimension\b[^>]*\bref=")([^"]+)"/g, (_match, prefix, reference) =>
    `${prefix}${shiftReference(reference, startColumn)}"`)
  shifted = shifted.replace(/(\b(?:activeCell|sqref)=")([^"]+)"/g, (_match, prefix, reference) =>
    `${prefix}${reference.split(' ').map(item => shiftReference(item, startColumn)).join(' ')}"`)
  shifted = shifted.replace(/\bspans="(\d+):(\d+)"/g, (_match, first, last) =>
    `spans="${first}:${Number(last) >= startColumn ? Number(last) + 1 : last}"`)

  const columns = shifted.match(/<cols>([\s\S]*?)<\/cols>/)
  if (columns) {
    const expanded = []
    for (const [, attributes] of columns[1].matchAll(/<col\b([^>]*)\/?>/g)) {
      const first = Number(readAttribute(attributes, 'min'))
      const last = Number(readAttribute(attributes, 'max'))
      const remainingAttributes = attributes
        .replace(/\/$/, '')
        .replace(/\s+min="[^"]*"/, '')
        .replace(/\s+max="[^"]*"/, '')
      for (let index = first; index <= last; index += 1) {
        const target = index >= startColumn ? index + 1 : index
        expanded.push({ index: target, attributes: remainingAttributes })
      }
    }
    expanded.sort((left, right) => left.index - right.index)
    shifted = shifted.replace(columns[0], `<cols>${expanded
      .map(column => `<col min="${column.index}" max="${column.index}"${column.attributes}/>`).join('')}</cols>`)
  }
  shifted = shifted.replace(/<row\b[^>]*>[\s\S]*?<\/row>/g, rowXml => {
    const row = parseRow(rowXml)
    const rowNumber = Number(readAttribute(row.attributes, 'r'))
    const targetIndex = startColumn
    const sourceCell = row.cells.get(targetIndex + 1)
    if (sourceCell && !row.cells.has(targetIndex)) {
      const reference = `${columnName(targetIndex)}${rowNumber}`
      row.cells.set(targetIndex, {
        reference,
        attributes: `r="${reference}"${sourceCell.attributes.replace(/\s+r="[^"]*"/, '')}`,
        xml: renderCell(reference, null, sourceCell.attributes)
      })
    }
    return renderRow(row.attributes, row.cells, row.remainder)
  })
  return shifted
}

function writeTable(sheetXml, records, columns, headerUpdates = {}) {
  const headerRow = 2
  const firstDataRow = 3
  const baseRowXml = getRowXml(sheetXml, firstDataRow)
  if (!baseRowXml) throw new Error('报告书模板缺少数据行格式')
  const rows = [...sheetXml.matchAll(/<row\b[^>]*\br="(\d+)"/g)].map(([, number]) => Number(number))
  const existingLastDataRow = Math.max(firstDataRow, ...rows.filter(number => number >= firstDataRow))
  const lastDataRow = Math.max(existingLastDataRow, firstDataRow + records.length - 1)

  for (const [column, value] of Object.entries(headerUpdates)) {
    sheetXml = setWorksheetCells(sheetXml, { [`${column}${headerRow}`]: value }, headerRow)
  }
  for (let rowNumber = firstDataRow; rowNumber <= lastDataRow; rowNumber += 1) {
    const record = records[rowNumber - firstDataRow]
    const values = Object.fromEntries(columns.map(([column, field]) => [
      `${column}${rowNumber}`,
      record ? record[field] : null
    ]))
    sheetXml = setWorksheetRow(sheetXml, rowNumber, values, baseRowXml)
  }
  return updateDimension(sheetXml)
}

function projectLocation(projectInfo) {
  return [projectInfo.province, projectInfo.cityDistrict, projectInfo.address]
    .map(value => String(value ?? '').trim())
    .filter(Boolean)
    .join(' ')
}

function safeFileName(value) {
  const name = String(value ?? '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/[. ]+$/g, '')
    .trim()
  return name || '项目'
}

async function createWorkbook(templateDataUrl, report) {
  if (!templateDataUrl.startsWith('data:') || !templateDataUrl.includes(';base64,')) {
    throw new Error('报告书模板未正确内嵌到应用中')
  }
  const encoded = templateDataUrl.slice(templateDataUrl.indexOf(',') + 1)
  const binary = atob(encoded)
  const templateBytes = Uint8Array.from(binary, character => character.charCodeAt(0))
  const files = unzipSync(templateBytes)
  const sheets = templateSheetPaths(files)
  const requiredSheets = ['项目总览', '建材生产碳排放量', '运输碳排放量', '施工碳排放量', '回收碳排放量']
  for (const name of requiredSheets) {
    if (!sheets.has(name)) throw new Error(`报告书模板缺少“${name}”工作表`)
  }

  const { projectInfo, buildMaterials, transportMaterials, constructionMaterials, recyclingMaterials } = report
  const readSheet = name => strFromU8(files[sheets.get(name)])
  const writeSheet = (name, xml) => { files[sheets.get(name)] = strToU8(xml) }
  let overview = readSheet('项目总览')
  const projectImage = await imageAssetFromProjectInfo(projectInfo)
  overview = setWorksheetCells(overview, {
    B2: projectInfo.projectName || '',
    B3: projectLocation(projectInfo),
    B4: Number(projectInfo.buildingArea) || 0,
    B5: projectInfo.buildingType || '',
    B6: projectImage ? '' : '未提供',
    A9: '净碳排放总量（tCO₂e）',
    F9: '单位建筑面积净碳排放量（kgCO₂e/㎡）'
  })
  overview = setWorksheetCells(overview, {
    A10: report.emissions.net,
    B10: report.emissions.build,
    C10: report.emissions.transport,
    D10: report.emissions.construction,
    E10: report.emissions.recycling,
    F10: report.emissions.unitAreaNet,
    G10: report.totalCost,
    H10: report.unitCostEmission,
    I10: report.unitAreaCost
  }, 10)
  writeSheet('项目总览', updateDimension(overview))
  if (projectImage) addProjectImage(files, sheets.get('项目总览'), projectImage)

  let buildSheet = readSheet('建材生产碳排放量')
  buildSheet = setWorksheetCells(buildSheet, {
    A1: '建材生产碳排放量',
    E1: `${report.emissions.build.toFixed(3)} tCO₂e`
  })
  buildSheet = writeTable(buildSheet, buildMaterials.map((material, index) => ({
    sequence: index + 1,
    name: material.materialName,
    type: material.type,
    quantity: material.quantity,
    factor: material.emissionFactor,
    emission: material.emissionAmount,
    marketPrice: material.marketPrice,
    unitPrice: material.unitPrice,
    totalPrice: material.totalPrice,
    recyclingFactor: material.recyclingFactor,
    recyclingCoefficient: material.recyclingCoefficient
  })), [
    ['A', 'sequence'], ['B', 'name'], ['C', 'type'], ['D', 'quantity'], ['E', 'factor'],
    ['F', 'emission'], ['G', 'marketPrice'], ['H', 'unitPrice'], ['I', 'totalPrice'],
    ['J', 'recyclingFactor'], ['K', 'recyclingCoefficient']
  ], { G: '市场价（元）', H: '成交价（元）' })
  writeSheet('建材生产碳排放量', buildSheet)

  let transportSheet = readSheet('运输碳排放量')
  transportSheet = setWorksheetCells(transportSheet, {
    A1: '运输阶段',
    F1: `${report.emissions.transport.toFixed(3)} tCO₂e`
  })
  transportSheet = writeTable(transportSheet, transportMaterials.map((material, index) => ({
    sequence: index + 1,
    vehicle: material.vehicleName,
    cargo: material.transportedMaterial,
    quantity: material.transportQuantity,
    distance: material.transportDistance,
    energyType: material.energyType,
    factor: material.emissionFactor,
    emission: material.emissionAmount,
    unitPrice: material.transportUnitPrice,
    totalPrice: material.transportTotalPrice
  })), [
    ['A', 'sequence'], ['B', 'vehicle'], ['C', 'cargo'], ['D', 'quantity'], ['E', 'distance'],
    ['F', 'energyType'], ['G', 'factor'], ['H', 'emission'], ['I', 'unitPrice'], ['J', 'totalPrice']
  ], { I: '运输单价（元）', J: '运输总价（万元）' })
  writeSheet('运输碳排放量', transportSheet)

  let constructionSheet = shiftWorksheetColumns(readSheet('施工碳排放量'), 3)
  constructionSheet = setWorksheetCells(constructionSheet, {
    A1: '施工阶段',
    G1: `${report.emissions.construction.toFixed(3)} tCO₂e`,
    C2: '台班数',
    D2: '能源类型',
    E2: '单位台班能耗',
    F2: '能源总耗',
    G2: '碳排放因子',
    H2: '碳排放量（tCO₂e）',
    I2: '台班单价（元）',
    J2: '台班总价（万元）'
  })
  constructionSheet = writeTable(constructionSheet, constructionMaterials.map((material, index) => ({
    sequence: index + 1,
    machinery: material.machineryName,
    shiftCount: material.shiftCount,
    energyType: material.energyType,
    energyPerShift: material.energyPerShift,
    totalEnergy: material.totalEnergy,
    factor: material.emissionFactor,
    emission: material.emissionAmount / 1000,
    unitPrice: material.shiftUnitPrice,
    totalPrice: material.totalPrice
  })), [
    ['A', 'sequence'], ['B', 'machinery'], ['C', 'shiftCount'], ['D', 'energyType'],
    ['E', 'energyPerShift'], ['F', 'totalEnergy'], ['G', 'factor'], ['H', 'emission'],
    ['I', 'unitPrice'], ['J', 'totalPrice']
  ])
  writeSheet('施工碳排放量', constructionSheet)

  let recyclingSheet = readSheet('回收碳排放量')
  recyclingSheet = setWorksheetCells(recyclingSheet, {
    A1: '回收阶段',
    F1: `${report.emissions.recycling.toFixed(3)} tCO₂e`
  })
  recyclingSheet = writeTable(recyclingSheet, recyclingMaterials.map((material, index) => ({
    sequence: index + 1,
    name: material.materialName,
    type: material.materialType,
    quantity: material.recyclingQuantity,
    factor: material.recyclingFactor,
    coefficient: material.recyclingCoefficient,
    reduction: material.reductionAmount,
    unitPrice: material.recyclingUnitPrice,
    residualValue: material.residualValue
  })), [
    ['A', 'sequence'], ['B', 'name'], ['C', 'type'], ['D', 'quantity'], ['E', 'factor'],
    ['F', 'coefficient'], ['G', 'reduction'], ['H', 'unitPrice'], ['I', 'residualValue']
  ], { H: '回收单价（元）', I: '回收残值（万元）' })
  writeSheet('回收碳排放量', recyclingSheet)

  files['xl/workbook.xml'] = strToU8(
    updatePrintAreas(strFromU8(files['xl/workbook.xml']), sheets, files)
  )
  return zipSync(files, { level: 6 })
}

export async function exportProjectReportExcel(templateDataUrl, report) {
  const workbook = await createWorkbook(templateDataUrl, report)
  const file = new Blob([workbook], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  })
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = `${safeFileName(report.projectInfo.projectName)}报告书.xlsx`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
