// 工作表定位与数值解析的共享工具：让三份清单导入器既能读取本系统导出的文件，
// 也能读取用户自行整理（工作表名、列名、含单位文本）的 Excel。
import { listWorkbookSheetNames, readWorkbookSheetRows } from '../data/transportCarbonConfigInfo.js'

// 从单元格文本中提取数值，兼容“2050kg/t”“3.71 kg柴油/台班”这类带单位的写法。
export function parseNumericCell(value) {
  const text = String(value ?? '').trim()
  if (!text) return null
  const match = text.match(/-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?/)
  if (!match) return null
  const number = Number(match[0])
  return Number.isFinite(number) ? number : null
}

// 先按约定的工作表名查找，找不到时扫描整本工作簿，取第一张含有效表头的工作表。
export function resolveSheetRows(workbookBytes, preferredSheetNames, hasHeaderRow) {
  for (const sheetName of preferredSheetNames) {
    const rows = readWorkbookSheetRows(workbookBytes, sheetName)
    if (rows && hasHeaderRow(rows)) return rows
  }
  for (const sheetName of listWorkbookSheetNames(workbookBytes)) {
    if (preferredSheetNames.includes(sheetName)) continue
    const rows = readWorkbookSheetRows(workbookBytes, sheetName)
    if (rows && hasHeaderRow(rows)) return rows
  }
  return null
}
