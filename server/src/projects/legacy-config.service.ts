import { Injectable, Logger } from '@nestjs/common'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import ExcelJS from 'exceljs'
import type { TransportEnergyType } from '@carbonledger/shared'

export interface LegacyBuildFactor {
  category: string
  name: string
  emissionFactor: number
  materialUnit: string
  recyclingFactor: number
  recyclingCoefficient: number
}

export interface LegacyTransportFactor {
  vehicleName: string
  energyType: TransportEnergyType
  emissionFactor: number
}

/** 旧版配置文件为空值占位符时记 0（与旧版 numericValue 一致） */
const EMPTY_PLACEHOLDERS = ['-', '—', '–', '/', '无', '暂无']

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/\s/g, '')
    .replace(/[（(].*?[）)]/g, '')
}

function toNumber(raw: unknown, allowEmpty: boolean): number {
  const text = String(raw ?? '').trim()
  if (allowEmpty && (!text || EMPTY_PLACEHOLDERS.includes(text))) return 0
  const value = Number(text)
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`配置数值无效：${text}`)
  }
  return value
}

/**
 * 旧版因子配置装载器：读取 server/assets/legacy/配置文件.xlsx
 * （与旧项目 ProjectCarbonCal 的“建筑碳排配置 / 运输碳排配置”工作表一致），
 * 用于新建项目时初始化项目级因子配置。
 */
@Injectable()
export class LegacyConfigService {
  private readonly logger = new Logger(LegacyConfigService.name)
  private loaded = false
  private buildFactors: LegacyBuildFactor[] = []
  private transportFactors: LegacyTransportFactor[] = []

  private get configPath(): string {
    return join(process.cwd(), 'assets', 'legacy', '配置文件.xlsx')
  }

  async load(): Promise<void> {
    if (this.loaded) return
    this.loaded = true
    if (!existsSync(this.configPath)) {
      this.logger.warn(`未找到旧版配置文件：${this.configPath}（将以空因子库启动）`)
      return
    }
    try {
      const buffer = await readFile(this.configPath)
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(buffer as unknown as ArrayBuffer)

      this.buildFactors = this.parseBuildSheet(workbook)
      this.transportFactors = this.parseTransportSheet(workbook)
      this.logger.log(
        `已装载旧版因子配置：建材 ${this.buildFactors.length} 条、运输 ${this.transportFactors.length} 条`,
      )
    } catch (error) {
      this.logger.error('旧版因子配置解析失败，将以空因子库启动', error as Error)
    }
  }

  private sheetRows(workbook: ExcelJS.Workbook, name: string): unknown[][] | null {
    const sheet = workbook.getWorksheet(name)
    if (!sheet) return null
    const rows: unknown[][] = []
    sheet.eachRow({ includeEmpty: false }, row => {
      const values: unknown[] = []
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const value = cell.value
        values[colNumber - 1] =
          value && typeof value === 'object' && 'result' in value
            ? (value as { result?: unknown }).result
            : value && typeof value === 'object' && 'text' in value
              ? (value as { text?: unknown }).text
              : value
      })
      rows.push(values)
    })
    return rows
  }

  private parseBuildSheet(workbook: ExcelJS.Workbook): LegacyBuildFactor[] {
    const rows = this.sheetRows(workbook, '建筑碳排配置')
    if (!rows || rows.length === 0) return []
    const headerRowIndex = rows.findIndex(row => row.some(value => String(value ?? '').trim()))
    if (headerRowIndex < 0) return []
    const headers = rows[headerRowIndex].map(normalizeHeader)
    const categoryIndex = headers.indexOf('类别')
    const nameIndex = headers.indexOf('名称')
    const factorIndex = headers.findIndex(header => header === '碳排因子' || header === '碳排放因子')
    const unitIndex = headers.indexOf('材料单位')
    const recyclingFactorIndex = headers.indexOf('回收因子')
    const recyclingCoefficientIndex = headers.indexOf('回收系数')
    if ([categoryIndex, nameIndex, factorIndex, unitIndex].some(index => index < 0)) {
      this.logger.warn('建筑碳排配置缺少必需列，跳过默认建材因子')
      return []
    }

    const result: LegacyBuildFactor[] = []
    for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex] ?? []
      const category = String(row[categoryIndex] ?? '').trim()
      const name = String(row[nameIndex] ?? '').trim()
      const materialUnit = String(row[unitIndex] ?? '').trim()
      const factorText = String(row[factorIndex] ?? '').trim()
      if (!category || !name || !materialUnit || !factorText) continue
      try {
        result.push({
          category,
          name,
          materialUnit,
          emissionFactor: toNumber(factorText, false),
          recyclingFactor: toNumber(
            recyclingFactorIndex < 0 ? '' : row[recyclingFactorIndex],
            true,
          ),
          recyclingCoefficient: toNumber(
            recyclingCoefficientIndex < 0 ? '' : row[recyclingCoefficientIndex],
            true,
          ),
        })
      } catch {
        this.logger.warn(`建筑碳排配置第 ${rowIndex + 1} 行数据无效，已跳过`)
      }
    }
    return result
  }

  private parseTransportSheet(workbook: ExcelJS.Workbook): LegacyTransportFactor[] {
    const rows = this.sheetRows(workbook, '运输碳排配置')
    if (!rows || rows.length === 0) return []
    const headerRowIndex = rows.findIndex(row => row.some(value => String(value ?? '').trim()))
    if (headerRowIndex < 0) return []
    const headers = rows[headerRowIndex].map(normalizeHeader)
    const nameIndex = headers.indexOf('名称')
    const energyTypeIndex = headers.indexOf('能源类型')
    const factorIndex = headers.findIndex(header => header.startsWith('因子'))
    if (nameIndex < 0 || energyTypeIndex < 0 || factorIndex < 0) {
      this.logger.warn('运输碳排配置缺少必需列，跳过默认运输因子')
      return []
    }

    const result: LegacyTransportFactor[] = []
    for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex] ?? []
      const vehicleName = String(row[nameIndex] ?? '').trim()
      const energyType = String(row[energyTypeIndex] ?? '').trim()
      const factorText = String(row[factorIndex] ?? '').trim()
      if (!vehicleName && !energyType && !factorText) continue
      const emissionFactor = Number(factorText)
      if (
        !vehicleName ||
        (energyType !== '柴油' && energyType !== '汽油') ||
        !Number.isFinite(emissionFactor) ||
        emissionFactor <= 0
      ) {
        this.logger.warn(`运输碳排配置第 ${rowIndex + 1} 行数据无效，已跳过`)
        continue
      }
      result.push({ vehicleName, energyType, emissionFactor })
    }
    return result
  }

  getBuildFactors(): LegacyBuildFactor[] {
    return this.buildFactors.map(factor => ({ ...factor }))
  }

  getTransportFactors(): LegacyTransportFactor[] {
    return this.transportFactors.map(factor => ({ ...factor }))
  }
}