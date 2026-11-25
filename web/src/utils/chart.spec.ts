import { describe, expect, it } from 'vitest'
import { aggregateTop, compositionShares, currentQuarterLabel, formatNumber, stageLabel, topPriceSeries } from './chart'

describe('aggregateTop', () => {
  it('按标签求和并按绝对值降序取前 N 项', () => {
    const rows = [
      { name: '混凝土', value: 10 },
      { name: '混凝土', value: 5 },
      { name: '钢材', value: -40 },
      { name: '玻璃', value: 1 },
      { name: '  ', value: 99 },
    ]
    const result = aggregateTop(rows, row => row.name, row => row.value, 2)
    expect(result).toEqual([
      { label: '钢材', value: -40 },
      { label: '混凝土', value: 15 },
    ])
  })

  it('忽略空白标签与非数值', () => {
    const rows = [{ name: '  ', value: 1 }, { name: '木材', value: Number.NaN }, { name: '砖', value: 2 }]
    const result = aggregateTop(rows, row => row.name, row => row.value)
    expect(result).toEqual([{ label: '砖', value: 2 }])
  })

  it('空输入返回空数组', () => {
    expect(aggregateTop([], () => '', () => 0)).toEqual([])
  })
})

describe('currentQuarterLabel', () => {
  it('按自然季度生成旧版市场价提示', () => {
    expect(currentQuarterLabel(new Date(2026, 0, 1))).toBe('2026 年第 1 季度')
    expect(currentQuarterLabel(new Date(2026, 2, 31))).toBe('2026 年第 1 季度')
    expect(currentQuarterLabel(new Date(2026, 3, 1))).toBe('2026 年第 2 季度')
    expect(currentQuarterLabel(new Date(2026, 11, 31))).toBe('2026 年第 4 季度')
  })
})

describe('formatNumber', () => {
  it('保留固定小数位并加千分位', () => {
    expect(formatNumber(1234567.8912, 3)).toBe('1,234,567.891')
    expect(formatNumber(0, 4)).toBe('0.0000')
    expect(formatNumber(null, 2)).toBe('0.00')
    expect(formatNumber(undefined, 1)).toBe('0.0')
  })
})

describe('stageLabel', () => {
  it('去掉旧版阶段后缀', () => {
    expect(stageLabel('建材碳排放')).toBe('建材')
    expect(stageLabel('回收碳计算')).toBe('回收')
    expect(stageLabel('运输碳排放')).toBe('运输')
  })
})

describe('topPriceSeries', () => {
  const rows = [
    { name: '钢材', emission: 10, market: 5200, deal: 5000 },
    { name: '混凝土', emission: 40, market: null, deal: 430 },
    { name: '玻璃', emission: 25, market: 1800, deal: 1750 },
  ]
  it('按碳排放降序取前 N 条并保留市场价/成交价', () => {
    const result = topPriceSeries(rows, {
      labelOf: row => row.name,
      weightOf: row => row.emission,
      marketPriceOf: row => row.market,
      dealPriceOf: row => row.deal,
      limit: 2,
    })
    expect(result).toEqual([
      { label: '混凝土', marketPrice: null, dealPrice: 430 },
      { label: '玻璃', marketPrice: 1800, dealPrice: 1750 },
    ])
  })

  it('市场价缺失时返回 null 而不是 0', () => {
    const result = topPriceSeries([{ name: '砖', emission: 1, market: undefined, deal: 2 }], {
      labelOf: row => row.name,
      weightOf: row => row.emission,
      marketPriceOf: row => row.market,
      dealPriceOf: row => row.deal,
    })
    expect(result[0].marketPrice).toBeNull()
    expect(result[0].dealPrice).toBe(2)
  })

  it('内部空格标签回退为未命名', () => {
    const result = topPriceSeries([{ name: '   ', emission: 1, market: 1, deal: 1 }], {
      labelOf: row => row.name,
      weightOf: row => row.emission,
      marketPriceOf: row => row.market,
      dealPriceOf: row => row.deal,
    })
    expect(result[0].label).toBe('未命名')
  })
})

describe('compositionShares', () => {
  it('计算百分比且总和为 100', () => {
    const result = compositionShares([
      { label: '土方', value: 30 },
      { label: '混凝土', value: 70 },
    ])
    expect(result.map(item => item.share)).toEqual([30, 70])
    expect(result.reduce((sum, item) => sum + item.share, 0)).toBe(100)
  })

  it('合计为 0 时返回空数组，避免除零', () => {
    expect(compositionShares([{ label: '空', value: 0 }])).toEqual([])
    expect(compositionShares([])).toEqual([])
  })
})