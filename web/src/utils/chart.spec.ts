import { describe, expect, it } from 'vitest'
import { aggregateTop, formatNumber, stageLabel } from './chart'

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