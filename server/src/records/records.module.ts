import { Module } from '@nestjs/common'
import { RecordsController } from './records.controller'
import { RecordsService } from './records.service'
import { RecordAccessService } from './record-access.service'
import { RecyclingSyncService } from './recycling-sync.service'
import { ProjectsModule } from '../projects/projects.module'

@Module({
  imports: [ProjectsModule],
  controllers: [RecordsController],
  providers: [RecordsService, RecordAccessService, RecyclingSyncService],
  exports: [RecordsService, RecordAccessService],
})
export class RecordsModule {}