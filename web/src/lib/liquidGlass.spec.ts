import { describe, expect, it } from 'vitest'
import {
  computeRoundedRectDisplacement,
  supportsSvgBackdropRefraction,
  type OpticalProfile,
} from './liquidGlass'

const sampleProfile: OpticalProfile = {
  id: 'test-pill',
  width: 200,
  height: 60,
  radius: 30,
  bezelWidth: 14,
  ior: 1.48,
  maxDisplacement: 8,
  dispersion: 0.03,
}

describe('liquidGlass optical refraction', () => {
  it('keeps the center optically flat with zero displacement', () => {
    const center = computeRoundedRectDisplacement(100, 30, sampleProfile)
    expect(center.dx).toBe(0)
    expect(center.dy).toBe(0)
    expect(center.edgeWeight).toBe(0)
  })

  it('produces inward-bending displacement along the curved bezel edges', () => {
    const topEdge = computeRoundedRectDisplacement(100, 3, sampleProfile)
    const bottomEdge = computeRoundedRectDisplacement(100, 57, sampleProfile)
    const leftEdge = computeRoundedRectDisplacement(3, 30, sampleProfile)
    const rightEdge = computeRoundedRectDisplacement(197, 30, sampleProfile)

    expect(topEdge.dy).toBeGreaterThan(0)
    expect(bottomEdge.dy).toBeLessThan(0)
    expect(leftEdge.dx).toBeGreaterThan(0)
    expect(rightEdge.dx).toBeLessThan(0)
    expect(topEdge.edgeWeight).toBeGreaterThan(0)
    expect(topEdge.edgeWeight).toBeLessThanOrEqual(1)
  })

  it('clamps displacement within [-1, 1] and zeroes pixels outside the shape', () => {
    const outside = computeRoundedRectDisplacement(1, 1, sampleProfile)
    expect(outside.dx).toBe(0)
    expect(outside.dy).toBe(0)

    const cornerBezel = computeRoundedRectDisplacement(12, 12, sampleProfile)
    expect(Math.abs(cornerBezel.dx)).toBeLessThanOrEqual(1)
    expect(Math.abs(cornerBezel.dy)).toBeLessThanOrEqual(1)
  })

  it('enables SVG backdrop refraction only on Chromium without reduced transparency', () => {
    const chromeUa =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36'
    const edgeUa =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 Edg/134.0.0.0'
    const safariUa =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'
    const firefoxUa =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:136.0) Gecko/20100101 Firefox/136.0'

    expect(supportsSvgBackdropRefraction(chromeUa, false)).toBe(true)
    expect(supportsSvgBackdropRefraction(edgeUa, false)).toBe(true)
    expect(supportsSvgBackdropRefraction(chromeUa, true)).toBe(false)
    expect(supportsSvgBackdropRefraction(safariUa, false)).toBe(false)
    expect(supportsSvgBackdropRefraction(firefoxUa, false)).toBe(false)
  })
})
