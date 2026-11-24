import { Module } from '@nestjs/common'
import { MulterModule } from '@nestjs/platform-express'
import { ImportExportController } from './import-export.controller'
import { ImportExportService } from './import-export.service'
import { ProjectsModule } from '../projects/projects.module'
import { RecordsModule } from '../records/records.module'
import { AnalysisModule } from '../analysis/analysis.module'

@Module({
  imports: [
    MulterModule.register({ limits: { fileSize: 20 * 1024 * 1024 } }),
    ProjectsModule,
    RecordsModule,
    AnalysisModule,
  ],
  controllers: [ImportExportController],
  providers: [ImportExportService],
})
export class ImportExportModule {}