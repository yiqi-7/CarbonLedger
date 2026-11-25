// Preserve the requested precision unless it would make a nonzero value look
// like zero. Very small values use a bound instead of implying exact zero.
export function formatDisplayNumber(value, maximumFractionDigits = 0) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  if (number === 0) return '0'
  const magnitude = Math.abs(number)
  if (magnitude < 0.000001) return number < 0 ? '>−0.000001' : '<0.000001'

  let digits = Math.max(0, Math.min(6, Math.trunc(maximumFractionDigits)))
  if (Math.round(magnitude * 10 ** digits) === 0) {
    digits = Math.min(6, Math.max(digits, Math.ceil(-Math.log10(magnitude))))
  }
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: digits }).format(number)
}
