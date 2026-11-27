import { Module } from '@nestjs/common'
import { VersionsController } from './versions.controller'
import { VersionsService } from './versions.service'
import { CalcVersionRepository } from './calc-version.repository'
import { SnapshotFactory } from './snapshot.factory'
import { AnalysisModule } from '../analysis/analysis.module'
import { ProjectsModule } from '../projects/projects.module'
import { AuditModule } from '../audit/audit.module'

@Module({
  imports: [AnalysisModule, ProjectsModule, AuditModule],
  controllers: [VersionsController],
  providers: [VersionsService, CalcVersionRepository, SnapshotFactory],
})
export class VersionsModule {}