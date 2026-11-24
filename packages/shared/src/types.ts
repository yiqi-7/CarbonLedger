/** 运输能源类型（旧版仅支持柴油、汽油） */
export type TransportEnergyType = '柴油' | '汽油'

/** 施工能源类型（旧版支持电力、柴油、汽油） */
export type ConstructionEnergyType = '电力' | '柴油' | '汽油'

/** 回收材料类别（自动联动映射：金属/保温材料/玻璃沿用，其余为其他） */
export type RecyclingCategory = '金属' | '保温材料' | '玻璃' | '其他'

/** 账号状态 */
export type UserStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

/** 账号角色 */
export type UserRole = 'ADMIN' | 'USER'

/** 建筑类型（旧版下拉） */
export const BUILDING_TYPES = ['商业综合体', '住宅', '公共建筑'] as const
export type BuildingType = (typeof BUILDING_TYPES)[number]

/** 核算阶段（旧版固定四项） */
export const ACCOUNTING_STAGES = ['建造生产阶段', '建造运输阶段', '施工建造阶段', '建造日常维护'] as const

/** 核算标准（旧版固定值） */
export const ACCOUNTING_STANDARD = 'GB/T 51366-2019'
