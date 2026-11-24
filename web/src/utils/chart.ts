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