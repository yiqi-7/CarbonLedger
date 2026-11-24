import { Module } from '@nestjs/common'
import { ProjectsController } from './projects.controller'
import { ProjectsService } from './projects.service'
import { LegacyConfigService } from './legacy-config.service'
import { AuditModule } from '../audit/audit.module'

@Module({
  imports: [AuditModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, LegacyConfigService],
  exports: [ProjectsService, LegacyConfigService],
})
export class ProjectsModule {}