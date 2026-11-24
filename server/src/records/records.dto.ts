import { Type } from 'class-transformer'
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator'

const RECYCLING_CATEGORIES = ['金属', '保温材料', '玻璃', '其他'] as const
const CONSTRUCTION_ENERGY = ['电力', '柴油', '汽油'] as const

// ---------- 建材 ----------

export class CreateBuildMaterialDto {
  /** 选择项目级建材因子配置（旧版“选配置新增建材”，类别/单位/因子/回收参数由配置带入） */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  factorConfigId?: number

  @IsOptional() @IsString() @MaxLength(120) materialName?: string
  @IsOptional() @IsString() @MaxLength(50) type?: string
  @IsOptional() @IsString() @MaxLength(20) unit?: string
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) emissionFactor?: number
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) recyclingFactor?: number
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) recyclingCoefficient?: number
  @IsOptional() @IsString() @MaxLength(50) source?: string

  @Type(() => Number)
  @IsNumber({}, { message: '用量必须是数字' })
  @Min(0.000001, { message: '用量必须大于 0' })
  quantity!: number

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: '市场价必须是数字' })
  @Min(0, { message: '市场价不能为负' })
  marketPrice?: number | null

  @Type(() => Number)
  @IsNumber({}, { message: '成交价必须是数字' })
  @Min(0.000001, { message: '成交价必须大于 0' })
  unitPrice!: number
}

export class UpdateBuildMaterialDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: '用量必须是数字' })
  @Min(0.000001, { message: '用量必须大于 0' })
  quantity?: number

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: '市场价必须是数字' })
  @Min(0, { message: '市场价不能为负' })
  marketPrice?: number | null

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: '成交价必须是数字' })
  @Min(0.000001, { message: '成交价必须大于 0' })
  unitPrice?: number
}

// ---------- 运输 ----------

export class CreateTransportRecordDto {
  /** 车辆必须来自项目运输因子配置（旧版：选车即联动能源类型与因子） */
  @Type(() => Number)
  @IsInt()
  factorConfigId!: number

  @IsString() @IsNotEmpty() @MaxLength(120) transportedMaterial!: string
  @IsOptional() @IsString() @MaxLength(50) source?: string

  @Type(() => Number)
  @IsNumber() @Min(0.000001, { message: '运输量必须大于 0' })
  transportQuantity!: number

  @Type(() => Number)
  @IsNumber() @Min(0.000001, { message: '运距必须大于 0' })
  transportDistance!: number

  @Type(() => Number)
  @IsNumber() @Min(0, { message: '运输单价不能为负' })
  transportUnitPrice!: number
}

export class UpdateTransportRecordDto {
  @IsOptional() @IsString() @MaxLength(120) transportedMaterial?: string
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0.000001) transportQuantity?: number
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0.000001) transportDistance?: number
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) transportUnitPrice?: number
}

// ---------- 施工 ----------

export class CreateConstructionRecordDto {
  @IsString() @IsNotEmpty() @MaxLength(120) machineryName!: string
  @IsIn(CONSTRUCTION_ENERGY, { message: '能源类型仅支持 电力 / 柴油 / 汽油' })
  energyType!: (typeof CONSTRUCTION_ENERGY)[number]

  @Type(() => Number)
  @IsInt({ message: '台班数必须是整数' })
  @Min(1, { message: '台班数必须大于 0' })
  shiftCount!: number

  @Type(() => Number)
  @IsNumber() @Min(0.000001, { message: '单位台班能耗必须大于 0' })
  energyPerShift!: number

  @IsOptional()
  @Type(() => Number)
  @IsNumber() @Min(0.0000001, { message: '碳排放因子必须大于 0' })
  emissionFactor?: number

  @Type(() => Number)
  @IsNumber() @Min(0, { message: '台班单价不能为负' })
  shiftUnitPrice!: number
}

export class UpdateConstructionRecordDto {
  @IsOptional() @IsString() @MaxLength(120) machineryName?: string
  @IsOptional()
  @IsIn(CONSTRUCTION_ENERGY, { message: '能源类型仅支持 电力 / 柴油 / 汽油' })
  energyType?: (typeof CONSTRUCTION_ENERGY)[number]
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) shiftCount?: number
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0.000001) energyPerShift?: number
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) shiftUnitPrice?: number
}

// ---------- 回收 ----------

export class CreateRecyclingRecordDto {
  @IsString() @IsNotEmpty() @MaxLength(120) materialName!: string
  @IsIn(RECYCLING_CATEGORIES, { message: '回收类别仅支持 金属 / 保温材料 / 玻璃 / 其他' })
  materialType!: (typeof RECYCLING_CATEGORIES)[number]

  @Type(() => Number)
  @IsNumber() @Min(0.000001, { message: '回收量必须大于 0' })
  recyclingQuantity!: number

  @IsOptional() @IsString() @MaxLength(20) unit?: string

  @Type(() => Number)
  @IsNumber() @Min(0, { message: '回收因子不能为负' })
  recyclingFactor!: number

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) recyclingCoefficient?: number
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) recyclingUnitPrice?: number
}

export class UpdateRecyclingRecordDto {
  @IsOptional() @IsString() @MaxLength(120) materialName?: string
  @IsOptional() @IsIn(RECYCLING_CATEGORIES) materialType?: (typeof RECYCLING_CATEGORIES)[number]
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0.000001) recyclingQuantity?: number
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) recyclingFactor?: number
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) recyclingCoefficient?: number
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) recyclingUnitPrice?: number
}