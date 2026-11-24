import { Controller, Get, Query } from '@nestjs/common'
import { AuditService } from './audit.service'
import { Roles } from '../auth/roles.decorator'

@Controller('admin/audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Roles('ADMIN')
  @Get()
  list(@Query('limit') limit?: string) {
    return this.auditService.list(limit ? Number(limit) : 100)
  }
}