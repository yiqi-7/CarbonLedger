import { describe, expect, it } from 'vitest'
import { DEFAULT_BUDGET, evaluateBundle } from '../../../scripts/check-web-bundle.mjs'

describe('web bundle budget gate', () => {
  it('passes when total output and checked assets fit their budgets', () => {
    const result = evaluateBundle([
      { path: 'assets/app.js', size: 900_000 },
      { path: 'assets/app.css', size: 200_000 },
      { path: 'fonts/app.woff2', size: 500_000 },
    ])

    expect(result.passed).toBe(true)
    expect(result.totalBytes).toBe(1_600_000)
    expect(result.oversizedAssets).toEqual([])
  })

  it('reports an oversized JavaScript or CSS asset', () => {
    const result = evaluateBundle([
      { path: 'assets/app.js', size: DEFAULT_BUDGET.maxAssetBytes + 1 },
    ])

    expect(result.passed).toBe(false)
    expect(result.totalWithinBudget).toBe(true)
    expect(result.oversizedAssets).toEqual([
      { path: 'assets/app.js', size: DEFAULT_BUDGET.maxAssetBytes + 1 },
    ])
  })

  it('includes every dist file in the total budget', () => {
    const result = evaluateBundle([
      { path: 'assets/app.js', size: 100 },
      { path: 'fonts/app.woff2', size: 901 },
    ], { ...DEFAULT_BUDGET, maxTotalBytes: 1_000, checkedExtensions: [...DEFAULT_BUDGET.checkedExtensions] })

    expect(result.totalWithinBudget).toBe(false)
    expect(result.passed).toBe(false)
  })
})
