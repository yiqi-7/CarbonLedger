import { Module } from '@nestjs/common'
import { VersionsController } from './versions.controller'
import { VersionsService } from './versions.service'
import { AnalysisModule } from '../analysis/analysis.module'
import { ProjectsModule } from '../projects/projects.module'
import { AuditModule } from '../audit/audit.module'

@Module({
  imports: [AnalysisModule, ProjectsModule, AuditModule],
  controllers: [VersionsController],
  providers: [VersionsService],
})
export class VersionsModule {}