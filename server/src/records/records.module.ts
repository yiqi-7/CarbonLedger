import { Module } from '@nestjs/common'
import { RecordsController } from './records.controller'
import { RecordsService } from './records.service'
import { RecordAccessService } from './record-access.service'
import { ProjectsModule } from '../projects/projects.module'

@Module({
  imports: [ProjectsModule],
  controllers: [RecordsController],
  providers: [RecordsService, RecordAccessService],
  exports: [RecordsService],
})
export class RecordsModule {}