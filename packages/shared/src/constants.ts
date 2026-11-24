import type { ConstructionEnergyType, TransportEnergyType } from './types'

/** 旧版运输能源类型列表（顺序与旧代码一致） */
export const TRANSPORT_ENERGY_TYPES: readonly TransportEnergyType[] = ['柴油', '汽油']

/**
 * 旧版施工能源因子常量（硬编码沿用）：
 * 电力 0.581 kg/kWh、柴油 2.632 kg/kg、汽油 2.34 kg/kg
 */
export const CONSTRUCTION_ENERGY_TYPES: Record<
  ConstructionEnergyType,
  { unit: string; emissionFactor: number }
> = {
  电力: { unit: 'kWh', emissionFactor: 0.581 },
  柴油: { unit: 'kg', emissionFactor: 2.632 },
  汽油: { unit: 'kg', emissionFactor: 2.34 },
}

/** 施工能源类型列表（键顺序与旧代码一致） */
export const CONSTRUCTION_ENERGY_TYPE_LIST =
  Object.keys(CONSTRUCTION_ENERGY_TYPES) as ConstructionEnergyType[]

/** 回收联动沿用原类别的建材类别；其余映射为“其他” */
export const RECYCLING_PRESERVED_CATEGORIES = ['金属', '保温材料', '玻璃'] as const

/** 旧版建材导入的类别默认单位映射 */
export const BUILD_MATERIAL_DEFAULT_UNITS: Record<string, string> = {
  混凝土: 'm³',
  金属: 't',
  钢材: 't',
  砌体: '㎡',
  保温材料: 'm³',
  水泥及砂浆: 't',
  玻璃: 'm²',
  其他: 't',
}

/** 上传文件大小上限（与旧版一致：20MB） */
export const MAX_IMPORT_FILE_SIZE = 20 * 1024 * 1024

/** 项目模型图片上限（与旧版一致：10MB） */
export const MAX_MODEL_IMAGE_SIZE = 10 * 1024 * 1024

/** 市场价来源提示（旧版沿用） */
export const MARKET_PRICE_SOURCE = 'www.zjzj.net'
