import { Module } from '@nestjs/common'
import { AnalysisController } from './analysis.controller'
import { AnalysisService } from './analysis.service'
import { ProjectsModule } from '../projects/projects.module'

@Module({
  imports: [ProjectsModule],
  controllers: [AnalysisController],
  providers: [AnalysisService],
  exports: [AnalysisService],
})
export class AnalysisModule {}