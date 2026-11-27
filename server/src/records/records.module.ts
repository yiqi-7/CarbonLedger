import { Module } from '@nestjs/common'
import { RecordsController } from './records.controller'
import { RecordsService } from './records.service'
import { BuildRecordService } from './build-record.service'
import { ConstructionRecordService } from './construction-record.service'
import { RecordAccessService } from './record-access.service'
import { RecyclingSyncService } from './recycling-sync.service'
import { TransportRecordService } from './transport-record.service'
import { ProjectsModule } from '../projects/projects.module'

@Module({
  imports: [ProjectsModule],
  controllers: [RecordsController],
  providers: [
    RecordsService,
    BuildRecordService,
    ConstructionRecordService,
    RecordAccessService,
    RecyclingSyncService,
    TransportRecordService,
  ],
  exports: [RecordsService, RecordAccessService],
})
export class RecordsModule {}