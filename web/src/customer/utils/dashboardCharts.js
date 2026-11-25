export function chartX(index, count, left = 42, right = 348) {
  return count < 2 ? (left + right) / 2 : left + index * (right - left) / (count - 1)
}

/** One domain and pixel range for ticks, bars, line paths, and point markers. */
export function createChartScale(values, top, bottom, intervals = 4) {
  const finite = values.filter(Number.isFinite)
  const min = Math.min(0, ...finite)
  const observedMax = Math.max(0, ...finite)
  const max = observedMax === min ? min + 1 : observedMax
  const y = value => bottom - (value - min) / (max - min) * (bottom - top)
  const zeroY = y(0)
  return {
    min,
    max,
    zeroY,
    y,
    ticks: Array.from({ length: intervals + 1 }, (_, index) => {
      const value = min + (max - min) * index / intervals
      return { value, y: y(value) }
    }),
    bar: value => ({ y: Math.min(zeroY, y(value)), height: Math.abs(y(value) - zeroY) })
  }
}

export function linePoints(items, field, scale, left = 42, right = 348) {
  return items
    .map((item, index) => Number.isFinite(item[field])
      ? `${chartX(index, items.length, left, right)},${scale.y(item[field])}`
      : null)
    .filter(Boolean)
    .join(' ')
}

/** Keep the full pie total represented when its compact legend has six rows. */
export function groupPieItems(items, limit = 6) {
  if (items.length <= limit) return items
  const otherItems = items.slice(limit - 1)
  return [
    ...items.slice(0, limit - 1),
    { label: `其他（${otherItems.length}项）`, value: otherItems.reduce((sum, item) => sum + item.value, 0) }
  ]
}
