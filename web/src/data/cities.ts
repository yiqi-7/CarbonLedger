import chinaCities from '@/data/chinaCities.json'

const provinceMap = chinaCities as Record<string, string[]>

/** 全部省级行政区（旧版 chinaCities.json 顺序） */
export const provinces: string[] = Object.keys(provinceMap)

/** 指定省份下的市/区列表；未知省份返回空数组 */
export function districtsOf(province: string): string[] {
  return provinceMap[province] ?? []
}

/** 省份切换后，若当前市/区不属于新省份则清空 */
export function normalizeDistrict(province: string, district: string): string {
  return districtsOf(province).includes(district) ? district : ''
}