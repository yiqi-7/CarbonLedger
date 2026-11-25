export type BarItem = { label: string; value: number; color?: string }

/** 按标签聚合后取绝对值最大的前 N 项（旧版首页分布图口径） */
export function aggregateTop<T>(
  rows: T[],
  labelOf: (row: T) => string,
  valueOf: (row: T) => number,
  limit = 8,
): BarItem[] {
  const totals = new Map<string, number>()
  for (const row of rows) {
    const label = (labelOf(row) || '').trim()
    if (!label) continue
    const value = Number(valueOf(row))
    if (!Number.isFinite(value)) continue
    totals.set(label, (totals.get(label) ?? 0) + value)
  }
  return [...totals.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => Math.abs(right.value) - Math.abs(left.value))
    .slice(0, limit)
}

export type PricePoint = { label: string; marketPrice: number | null; dealPrice: number }

export function currentQuarterLabel(date = new Date()): string {
  const quarter = Math.floor(date.getMonth() / 3) + 1
  return `${date.getFullYear()} 年第 ${quarter} 季度`
}

/**
 * 建材市场价格对比取数（旧版首页口径）：
 * 按碳排放量降序取前 N 条，保留市场价（可为空）与成交价。
 */
export function topPriceSeries<T>(
  rows: T[],
  options: {
    labelOf: (row: T) => string
    weightOf: (row: T) => number
    marketPriceOf: (row: T) => number | null | undefined
    dealPriceOf: (row: T) => number
    limit?: number
  },
): PricePoint[] {
  const limit = options.limit ?? 6
  return [...rows]
    .filter(row => Number.isFinite(Number(options.weightOf(row))))
    .sort((left, right) => Number(options.weightOf(right)) - Number(options.weightOf(left)))
    .slice(0, limit)
    .map(row => {
      const rawMarket = options.marketPriceOf(row)
      const market = rawMarket === null || rawMarket === undefined ? null : Number(rawMarket)
      const deal = Number(options.dealPriceOf(row))
      return {
        label: (options.labelOf(row) || '未命名').trim() || '未命名',
        marketPrice: Number.isFinite(market as number) ? (market as number) : null,
        dealPrice: Number.isFinite(deal) ? deal : 0,
      }
    })
}

/** 组成占比：返回每项百分比，总和为 100（无数据时返回空数组） */
export function compositionShares(items: BarItem[]): Array<BarItem & { share: number }> {
  const total = items.reduce((sum, item) => sum + Math.max(0, Number(item.value) || 0), 0)
  if (total <= 0) return []
  return items.map(item => ({ ...item, share: (Math.max(0, Number(item.value) || 0) / total) * 100 }))
}

/** 千分位 + 固定小数位格式化 */
export function formatNumber(value: number | null | undefined, digits = 3): string {
  return Number(value || 0).toLocaleString('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

/** 生命周期阶段标签精简：去掉“碳排放”“碳计算”后缀 */
export function stageLabel(name: string): string {
  return (name || '').replace('碳排放', '').replace('碳计算', '')
}