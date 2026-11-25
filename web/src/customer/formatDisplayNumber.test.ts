import { describe, expect, it } from 'vitest'
import { formatDisplayNumber } from './formatDisplayNumber.js'

describe('display precision for carbon and cost values', () => {
  it('keeps true zero separate from small positive or negative quantities', () => {
    expect(formatDisplayNumber(0, 3)).toBe('0')
    expect(formatDisplayNumber(-0, 3)).toBe('0')
    expect(formatDisplayNumber(0.004, 1)).toBe('0.004')
    expect(formatDisplayNumber(-0.004, 1)).toBe('-0.004')
    // One 0.1 kWh electric shift emits 0.0000581 tonnes.
    expect(formatDisplayNumber(0.0000581, 3)).toBe('0.00006')
    expect(formatDisplayNumber(-0.0000581, 3)).toBe('-0.00006')
  })

  it('shows a signed bound below six decimal places and preserves the exact boundary', () => {
    expect(formatDisplayNumber(0.0000009, 3)).toBe('<0.000001')
    expect(formatDisplayNumber(-0.0000009, 3)).toBe('>−0.000001')
    expect(formatDisplayNumber(0.000001, 0)).toBe('0.000001')
    expect(formatDisplayNumber(-0.000001, 0)).toBe('-0.000001')
  })

  it('retains ordinary rounding and grouping when the requested precision is sufficient', () => {
    expect(formatDisplayNumber(12345.6789, 2)).toBe('12,345.68')
    expect(formatDisplayNumber(-12345.6789, 2)).toBe('-12,345.68')
    expect(formatDisplayNumber(0.218, 3)).toBe('0.218')
    expect(formatDisplayNumber(2)).toBe('2')
    expect(formatDisplayNumber(Number.NaN)).toBe('—')
  })
})
