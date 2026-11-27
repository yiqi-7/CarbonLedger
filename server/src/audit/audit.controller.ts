import { Controller, Get, Query } from '@nestjs/common'
import { AuditService } from './audit.service'
import { Roles } from '../auth/roles.decorator'
import { AuditQueryDto } from './audit.dto'

@Controller('admin/audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Roles('ADMIN')
  @Get()
  list(@Query() query: AuditQueryDto) {
    return this.auditService.list(query.limit)
  }
}