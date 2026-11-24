import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator'
import { Type } from 'class-transformer'

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty({ message: '请输入项目名称' })
  @MaxLength(120)
  projectName!: string

  @IsString() @MaxLength(50) province: string = ''
  @IsString() @MaxLength(50) cityDistrict: string = ''
  @IsString() @MaxLength(200) address: string = ''
  @IsString() @MaxLength(50) floorCount: string = ''
  @IsString() @MaxLength(50) buildingType: string = ''
  @IsString() @MaxLength(100) structureType: string = ''
  @IsString() @MaxLength(50) designLife: string = ''
  @IsString() @MaxLength(50) startDate: string = ''
  @IsString() @MaxLength(50) plannedCompletionDate: string = ''
  @IsString() @MaxLength(50) projectManager: string = ''
  @IsString() @MaxLength(50) accountingStandard: string = 'GB/T 51366-2019'

  /** 建筑面积：必填，必须为正数（单位面积指标分母） */
  @Type(() => Number)
  @IsNumber({}, { message: '建筑面积必须是数字' })
  @Min(0.000001, { message: '建筑面积必须大于 0' })
  buildingArea!: number

  /** 模型图片 data URL（≤10MB 文件，base64 后约 1.4 千万字符） */
  @IsOptional()
  @IsString()
  @MaxLength(14000000, { message: '模型图片过大，请压缩到 10MB 以内' })
  modelImage?: string | null

  @IsOptional() @IsString() @MaxLength(200) modelImageName?: string
}

export class UpdateProjectDto extends CreateProjectDto {}

export class BuildFactorDto {
  @IsString() @IsNotEmpty() @MaxLength(50) category!: string
  @IsString() @IsNotEmpty() @MaxLength(120) name!: string
  @Type(() => Number) @IsNumber() @Min(0) emissionFactor!: number
  @IsString() @IsNotEmpty() @MaxLength(20) materialUnit!: string
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) recyclingFactor?: number
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) recyclingCoefficient?: number
}

export class TransportFactorDto {
  @IsString() @IsNotEmpty() @MaxLength(120) vehicleName!: string
  @IsString() @IsNotEmpty() energyType!: string
  @Type(() => Number) @IsNumber() @Min(0.0000001) emissionFactor!: number
}

export class SeedFactorsDto {
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  overwrite?: boolean
}