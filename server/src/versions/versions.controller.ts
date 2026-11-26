import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common'
import { VersionsService } from './versions.service'
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator'

@Controller('projects/:projectId/versions')
export class VersionsController {
  constructor(private readonly versions: VersionsService) {}

  /** 保存核算版本（仅用户显式点击保存时调用） */
  @Post()
  save(@CurrentUser() user: AuthUser, @Param('projectId', ParseIntPipe) projectId: number) {
    return this.versions.save(projectId, user.userId)
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Param('projectId', ParseIntPipe) projectId: number) {
    return this.versions.list(projectId, user.userId)
  }

  @Patch(':versionId')
  rename(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('versionId', ParseIntPipe) versionId: number,
    @Body('name') name: string,
  ) {
    return this.versions.rename(projectId, user.userId, versionId, name || '')
  }

  @Delete(':versionId')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('versionId', ParseIntPipe) versionId: number,
  ) {
    return this.versions.remove(projectId, user.userId, versionId)
  }

  @Get(':versionId')
  detail(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('versionId', ParseIntPipe) versionId: number,
  ) {
    return this.versions.detail(projectId, user.userId, versionId)
  }
}