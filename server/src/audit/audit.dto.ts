import { Type } from 'class-transformer'
import { IsInt, IsOptional, Max, Min } from 'class-validator'

export class AuditQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '日志条数必须是整数' })
  @Min(1, { message: '日志条数至少为 1' })
  @Max(500, { message: '日志条数不能超过 500' })
  limit = 100
}
