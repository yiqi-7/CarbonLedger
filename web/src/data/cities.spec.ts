import { describe, expect, it } from 'vitest'
import { districtsOf, normalizeDistrict, provinces } from './cities'

describe('chinaCities', () => {
  it('包含 31 个省级行政区以上', () => {
    expect(provinces.length).toBeGreaterThanOrEqual(31)
    expect(provinces).toContain('北京市')
    expect(provinces).toContain('广东省')
  })

  it('按省份返回市/区列表', () => {
    expect(districtsOf('北京市')).toContain('朝阳区')
    expect(districtsOf('广东省').length).toBeGreaterThan(5)
  })

  it('未知省份返回空数组', () => {
    expect(districtsOf('不存在的省')).toEqual([])
  })

  it('省份切换时清空不匹配的市/区', () => {
    expect(normalizeDistrict('北京市', '朝阳区')).toBe('朝阳区')
    expect(normalizeDistrict('广东省', '朝阳区')).toBe('')
    expect(normalizeDistrict('北京市', '')).toBe('')
  })
})