import { Module } from '@nestjs/common'
import { ReportsController } from './reports.controller'
import { ReportsService } from './reports.service'
import { ProjectsModule } from '../projects/projects.module'
import { AnalysisModule } from '../analysis/analysis.module'

@Module({
  imports: [ProjectsModule, AnalysisModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}