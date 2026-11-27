import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common'
import { ProjectsService } from './projects.service'
import { BuildFactorDto, CreateProjectDto, SeedFactorsDto, UpdateProjectDto, TransportFactorDto } from './project.dto'
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator'
import { FileInterceptor } from '@nestjs/platform-express'
import { UploadedFile, UseInterceptors } from '@nestjs/common'

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.projectsService.list(user.userId)
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProjectDto) {
    return this.projectsService.create(user.userId, dto)
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.projectsService.detail(id, user.userId)
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(id, user.userId, dto)
  }

  @Post(':id/model-image')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadModelImage(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file?.buffer) throw new BadRequestException('请上传模型图片')
    return this.projectsService.updateModelImage(id, user.userId, file.buffer, file.originalname, file.mimetype)
  }

  @Delete(':id/model-image')
  removeModelImage(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.projectsService.removeModelImage(id, user.userId)
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.projectsService.remove(id, user.userId)
  }

  // ---------- 建材因子配置 ----------

  @Get(':id/build-factors')
  listBuildFactors(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.projectsService.listBuildFactors(id, user.userId)
  }

  @Post(':id/build-factors')
  createBuildFactor(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: BuildFactorDto,
  ) {
    return this.projectsService.createBuildFactor(id, user.userId, dto)
  }

  @Patch(':id/build-factors/:factorId')
  updateBuildFactor(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('factorId', ParseIntPipe) factorId: number,
    @Body() dto: BuildFactorDto,
  ) {
    return this.projectsService.updateBuildFactor(id, user.userId, factorId, dto)
  }

  @Delete(':id/build-factors/:factorId')
  removeBuildFactor(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('factorId', ParseIntPipe) factorId: number,
  ) {
    return this.projectsService.removeBuildFactor(id, user.userId, factorId)
  }

  // ---------- 运输因子配置 ----------

  @Get(':id/transport-factors')
  listTransportFactors(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.projectsService.listTransportFactors(id, user.userId)
  }

  @Post(':id/transport-factors')
  createTransportFactor(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TransportFactorDto,
  ) {
    return this.projectsService.createTransportFactor(id, user.userId, dto)
  }

  @Patch(':id/transport-factors/:factorId')
  updateTransportFactor(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('factorId', ParseIntPipe) factorId: number,
    @Body() dto: TransportFactorDto,
  ) {
    return this.projectsService.updateTransportFactor(id, user.userId, factorId, dto)
  }

  @Delete(':id/transport-factors/:factorId')
  removeTransportFactor(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('factorId', ParseIntPipe) factorId: number,
  ) {
    return this.projectsService.removeTransportFactor(id, user.userId, factorId)
  }

  // ---------- 旧版因子装载 ----------

  @Post(':id/factors/seed')
  seedFactors(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Query() query: SeedFactorsDto,
  ) {
    return this.projectsService.seedFactors(id, user.userId, query.overwrite)
  }
}