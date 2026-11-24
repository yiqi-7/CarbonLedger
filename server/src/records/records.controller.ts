import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common'
import { RecordsService } from './records.service'
import {
  CreateBuildMaterialDto,
  CreateConstructionRecordDto,
  CreateRecyclingRecordDto,
  CreateTransportRecordDto,
  UpdateBuildMaterialDto,
  UpdateConstructionRecordDto,
  UpdateRecyclingRecordDto,
  UpdateTransportRecordDto,
} from './records.dto'
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator'

@Controller('projects/:projectId')
export class RecordsController {
  constructor(private readonly records: RecordsService) {}

  // ---------- 建材（建造生产） ----------

  @Get('build-materials')
  listBuildMaterials(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseIntPipe) projectId: number,
  ) {
    return this.records.listBuildMaterials(projectId, user.userId)
  }

  @Post('build-materials')
  createBuildMaterial(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: CreateBuildMaterialDto,
  ) {
    return this.records.createBuildMaterial(projectId, user.userId, dto)
  }

  @Patch('build-materials/:id')
  updateBuildMaterial(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBuildMaterialDto,
  ) {
    return this.records.updateBuildMaterial(projectId, user.userId, id, dto)
  }

  @Delete('build-materials/:id')
  removeBuildMaterial(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.records.removeBuildMaterial(projectId, user.userId, id)
  }

  // ---------- 运输（建造运输） ----------

  @Get('transport-records')
  listTransport(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseIntPipe) projectId: number,
  ) {
    return this.records.listTransportRecords(projectId, user.userId)
  }

  @Post('transport-records')
  createTransport(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: CreateTransportRecordDto,
  ) {
    return this.records.createTransportRecord(projectId, user.userId, dto)
  }

  @Patch('transport-records/:id')
  updateTransport(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTransportRecordDto,
  ) {
    return this.records.updateTransportRecord(projectId, user.userId, id, dto)
  }

  @Delete('transport-records/:id')
  removeTransport(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.records.removeTransportRecord(projectId, user.userId, id)
  }

  // ---------- 施工（施工建造） ----------

  @Get('construction-records')
  listConstruction(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseIntPipe) projectId: number,
  ) {
    return this.records.listConstructionRecords(projectId, user.userId)
  }

  @Post('construction-records')
  createConstruction(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: CreateConstructionRecordDto,
  ) {
    return this.records.createConstructionRecord(projectId, user.userId, dto)
  }

  @Patch('construction-records/:id')
  updateConstruction(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateConstructionRecordDto,
  ) {
    return this.records.updateConstructionRecord(projectId, user.userId, id, dto)
  }

  @Delete('construction-records/:id')
  removeConstruction(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.records.removeConstructionRecord(projectId, user.userId, id)
  }

  // ---------- 回收（减碳） ----------

  @Get('recycling-records')
  listRecycling(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseIntPipe) projectId: number,
  ) {
    return this.records.listRecyclingRecords(projectId, user.userId)
  }

  @Post('recycling-records')
  createRecycling(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: CreateRecyclingRecordDto,
  ) {
    return this.records.createRecyclingRecord(projectId, user.userId, dto)
  }

  @Patch('recycling-records/:id')
  updateRecycling(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRecyclingRecordDto,
  ) {
    return this.records.updateRecyclingRecord(projectId, user.userId, id, dto)
  }

  @Delete('recycling-records/:id')
  removeRecycling(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.records.removeRecyclingRecord(projectId, user.userId, id)
  }
}