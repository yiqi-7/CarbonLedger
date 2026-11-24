import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { AuditService } from './audit.service'
import { AuditController } from './audit.controller'
import { RolesGuard } from '../auth/roles.guard'

@Module({
  controllers: [AuditController],
  providers: [AuditService, { provide: APP_GUARD, useClass: RolesGuard }],
  exports: [AuditService],
})
export class AuditModule {}