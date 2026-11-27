import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import sharp from 'sharp'
import type { CalcVersionSnapshot } from '@carbonledger/shared'
import { ExcelReportRenderer } from './excel-report.renderer'
import { PdfReportRenderer } from './pdf-report.renderer'

async function modelImage(): Promise<string> {
  const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#287a54' } }).png().toBuffer()
  return `data:image/png;base64,${bytes.toString('base64')}`
}

function snapshot(image: string | null = null): CalcVersionSnapshot {
  return {
    versionNumber: 7,
    savedAt: '2025-01-02T03:04:05.000Z',
    savedByUserId: 3,
    project: {
      projectName: 'Renderer contract project',
      province: '测试省',
      cityDistrict: '测试市',
      address: '测试路 1 号',
      buildingArea: 100,
      floorCount: '5',
      buildingType: '办公建筑',
      structureType: '框架',
      designLife: '50年',
      modelImage: image,
      modelImageName: 'model.png',
      startDate: '',
      plannedCompletionDate: '',
      projectManager: '',
      accountingStandard: '测试标准',
      accountingStages: [],
    },
    factors: { build: [], transport: [] },
    buildMaterials: [],
    transportRecords: [],
    constructionRecords: [],
    recyclingRecords: [],
    summary: {
      build: { totalEmission: 1.25, totalMaterialCost: 0, emissionPerArea: 0 },
      transport: { totalEmission: 0.25, energyTotals: {} },
      construction: { totalEmission: 0.5, totalShiftCount: 0, energyTotals: {} },
      recycling: { totalReduction: 0.1, totalRecyclingQuantity: 0, recyclingUtilizationRate: 0, estimatedResidualValue: 0 },
      emission: {
        stages: [{ name: '建材生产', emission: 1.25 }],
        netEmission: 1.9,
        unitAreaNetEmission: 19,
        buildMaterialDetails: [],
      },
      cost: {
        totalCost: 2.5,
        buildCost: 2.5,
        topBuildMaterial: null,
        unitAreaBuildCost: 0.025,
        unitCostEmission: 0.76,
        buildDetails: [],
      },
    },
  }
}

describe('report renderer output contracts', () => {
  it('renders a readable Excel workbook with report values and a model image', async () => {
    const bytes = await new ExcelReportRenderer().render(snapshot(await modelImage()))
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(bytes as never)

    expect(bytes.subarray(0, 2).toString()).toBe('PK')
    expect(workbook.worksheets.map(sheet => sheet.name)).toEqual([
      '项目总览', '建材生产碳排放量', '运输碳排放量', '施工碳排放量', '回收碳排放量',
    ])
    const overview = workbook.getWorksheet('项目总览')!
    expect(overview.getCell('B2').value).toBe('Renderer contract project')
    expect(overview.getCell('A10').value).toBe(1.9)
    expect(overview.getCell('E10').value).toBe(-0.1)
    expect(overview.getImages()).toHaveLength(1)
  })

  it('renders a PDF document buffer with the report header and snapshot details', async () => {
    const bytes = await new PdfReportRenderer().render(snapshot(await modelImage()))

    expect(bytes.subarray(0, 8).toString()).toBe('%PDF-1.3')
    expect(bytes.length).toBeGreaterThan(500)
    expect(bytes.toString('latin1')).toContain('%%EOF')
  })

  it('renders Excel without a broken image and marks the unavailable image in the overview', async () => {
    const withInvalidImage = snapshot('data:image/png;base64,bm90LWltYWdl')
    const bytes = await new ExcelReportRenderer().render(withInvalidImage)
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(bytes as never)
    const overview = workbook.getWorksheet('项目总览')!

    expect(overview.getCell('B6').value).toBe('图片无法读取')
    expect(overview.getImages()).toHaveLength(0)
  })
})
