import { describe, expect, it } from 'vitest'
import { chartX, createChartScale, groupPieItems, linePoints } from './dashboardCharts.js'

describe('dashboard chart geometry', () => {
  it('keeps fractional emissions on the same scale as the axis', () => {
    const scale = createChartScale([0.02, 0.08], 28, 142)
    expect(scale.ticks.at(-1)).toEqual({ value: 0.08, y: 28 })
    expect(scale.bar(0.08)).toEqual({ y: 28, height: 114 })
    expect(scale.bar(0.02).height).toBeCloseTo(28.5)
  })

  it('uses the same unit height for emissions and recycling reductions', () => {
    const scale = createChartScale([20, 5, -10], 28, 155)
    expect(scale.bar(20).height).toBeCloseTo(scale.bar(-10).height * 2)
    expect(scale.bar(-10).y).toBe(scale.zeroY)
    expect(scale.y(-10)).toBe(155)
    expect(scale.y(20)).toBe(28)
  })

  it('places line vertices at the same coordinates as their markers', () => {
    const items = [{ cost: 0.2 }, { cost: 0.5 }, { cost: 0.1 }]
    const scale = createChartScale(items.map(item => item.cost), 34, 143)
    const points = linePoints(items, 'cost', scale, 55, 310).split(' ').map((point: string) => point.split(',').map(Number))
    expect(points).toEqual(items.map((item, index) => [chartX(index, items.length, 55, 310), scale.y(item.cost)]))
  })

  it('represents every pie item in its compact legend without changing the total', () => {
    const items = Array.from({ length: 9 }, (_, index) => ({ label: `机械${index}`, value: 9 - index }))
    const grouped = groupPieItems(items)
    expect(grouped).toHaveLength(6)
    expect(grouped.at(-1)).toEqual({ label: '其他（4项）', value: 10 })
    expect(grouped.reduce((sum: number, item: { value: number }) => sum + item.value, 0)).toBe(items.reduce((sum, item) => sum + item.value, 0))
  })

  it('keeps empty and all-zero charts finite', () => {
    for (const values of [[], [0, 0], [Number.NaN]]) {
      const scale = createChartScale(values, 28, 142)
      expect(scale.ticks.every(tick => Number.isFinite(tick.y))).toBe(true)
      expect(scale.bar(0)).toEqual({ y: 142, height: 0 })
    }
  })
})
