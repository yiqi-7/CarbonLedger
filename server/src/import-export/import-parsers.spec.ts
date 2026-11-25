import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import {
  parseBuildMaterialWorkbook,
  parseConstructionWorkbook,
  parseTransportWorkbook,
} from './import-parsers'
import {
  buildBuildMaterialWorkbook,
  buildConstructionWorkbook,
  buildTransportWorkbook,
} from './list-exporters'
import type { BuildMaterialRecord, ConstructionRecord, TransportRecord } from '@carbonledger/shared'

describe('旧版 Excel 导入规则', () => {
  it('建材表：完整导入，必需字段缺失时整表报错', async () => {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('材料清单')
    sheet.addRow(['材料名称', '类型', '用量', '碳排因子', '市场价（元）', '成交价（元）', '回收因子', '回收系数'])
    sheet.addRow(['混凝土', '混凝土', 120, 280, 330, 300, 80, 0.9])
    const parsed = parseBuildMaterialWorkbook(workbook)
    expect(parsed.materials).toHaveLength(1)
    expect(parsed.materials[0]).toMatchObject({
      materialName: '混凝土',
      quantity: 120,
      unit: 'm³',
      emissionFactor: 280,
      recyclingFactor: 80,
      recyclingCoefficient: 0.9,
    })

    sheet.getRow(2).getCell(1).value = '钢材'
    sheet.getRow(2).getCell(2).value = '钢材'
    const steel = parseBuildMaterialWorkbook(workbook)
    expect(steel.materials[0].type).toBe('金属')

    sheet.addRow(['钢材', '金属', '', 2, '', 4000, 0, 0])
    expect(() => parseBuildMaterialWorkbook(workbook)).toThrow('不能为空')
  })

  it('客户材料表：表名回退、无类型列、单位文本、零因子价格和空值占位均兼容', () => {
    const workbook = new ExcelJS.Workbook()
    workbook.addWorksheet('材料清单').addRow(['项目说明'])
    const sheet = workbook.addWorksheet('客户提供的清单')
    sheet.addRow(['名称', '使用量', '材料单位', '碳排放系数', '市场价格', '单价', '回收因子', '再生系数'])
    sheet.addRow(['新材料', '12.5 kg', 'kg', '2.05e3kg/t', '—', '0元', '/', '暂无'])
    sheet.addRow(['零排放', 1, '件', 0, '无', 10, '-', '–'])
    const parsed = parseBuildMaterialWorkbook(workbook)
    expect(parsed.sheetName).toBe('客户提供的清单')
    expect(parsed.materials).toEqual([
      { materialName: '新材料', type: '', quantity: 12.5, unit: 'kg', emissionFactor: 2050, marketPrice: null, unitPrice: 0, recyclingFactor: 0, recyclingCoefficient: 0 },
      { materialName: '零排放', type: '', quantity: 1, unit: '件', emissionFactor: 0, marketPrice: null, unitPrice: 10, recyclingFactor: 0, recyclingCoefficient: 0 },
    ])
    sheet.getRow(2).getCell(2).value = '0kg'
    expect(() => parseBuildMaterialWorkbook(workbook)).toThrow('回收系数无效')
  })

  it('运输表：仅旧版必填列用于跳过判定，万元单价转元', async () => {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('运输记录清单')
    sheet.addRow(['车辆名称', '运输货物', '运输量', '运距', '能源类型', '碳排放因子', '运输单价（万元）'])
    sheet.addRow(['柴油货车', '钢材', 10, 50, '柴油', 0.12, 0.0008])
    sheet.addRow(['缺少字段', '', 5, 20, '汽油', 0.1, 0.001])
    const parsed = parseTransportWorkbook(workbook)
    expect(parsed.records).toHaveLength(2)
    expect(parsed.records[0].transportUnitPrice).toBe(8)
    expect(parsed.records[1].transportedMaterial).toBe('')
    expect(parsed.skippedRows).toBe(0)
  })

  it('施工表：跳过不完整行，台班数必须为正安全整数', () => {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('工程台班清单')
    sheet.addRow(['机械名称', '台班数', '能源类型', '单位台班能耗', '碳排放因子', '台班单价（元）'])
    sheet.addRow(['塔吊', 3, '电力', 100, 0.581, 500])
    sheet.addRow(['缺失行', '', '柴油', 20, 2.632, 200])
    expect(parseConstructionWorkbook(workbook)).toMatchObject({
      skippedRows: 1,
      records: [{ machineryName: '塔吊', shiftCount: 3, energyType: '电力' }],
    })

    sheet.addRow(['错误台班', 1.5, '电力', 100, 0.581, 500])
    expect(() => parseConstructionWorkbook(workbook)).toThrow('数据无效')
  })
})

describe('旧版 Excel 导出列', () => {
  it('建材、运输、施工导出工作表和列名符合旧版清单', async () => {
    const build = await buildBuildMaterialWorkbook([] as BuildMaterialRecord[])
    const transport = await buildTransportWorkbook([] as TransportRecord[])
    const construction = await buildConstructionWorkbook([] as ConstructionRecord[])

    const readHeaders = async (bytes: Buffer) => {
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(bytes as unknown as ArrayBuffer)
      const sheet = workbook.worksheets[0]
      return {
        name: sheet.name,
        headers: sheet.getRow(1).values.slice(1),
      }
    }

    expect(await readHeaders(build)).toMatchObject({
      name: '材料清单',
      headers: ['材料名称', '类型', '用量', '碳排因子', '市场价（元）', '成交价（元）', '回收因子', '回收系数'],
    })
    expect(await readHeaders(transport)).toMatchObject({
      name: '运输记录清单',
      headers: ['车辆名称', '运输货物', '运输量', '运距', '能源类型', '碳排放因子', '运输单价（元）'],
    })
    expect(await readHeaders(construction)).toMatchObject({
      name: '工程台班清单',
      headers: ['机械名称', '台班数', '能源类型', '单位台班能耗', '碳排放因子', '台班单价（元）'],
    })
  })
})
