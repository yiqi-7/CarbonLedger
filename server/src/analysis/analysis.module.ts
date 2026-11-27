import { Module } from '@nestjs/common'
import { AnalysisController } from './analysis.controller'
import { AnalysisService } from './analysis.service'
import { AnalysisCalculator } from './analysis-calculator'
import { AnalysisDataLoader } from './analysis-data.loader'
import { ProjectsModule } from '../projects/projects.module'

@Module({
  imports: [ProjectsModule],
  controllers: [AnalysisController],
  providers: [AnalysisService, AnalysisDataLoader, AnalysisCalculator],
  exports: [AnalysisService],
})
export class AnalysisModule {}