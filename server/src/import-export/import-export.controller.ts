import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import type { Response } from 'express'
import { ImportExportService } from './import-export.service'
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator'

function sendXlsx(response: Response, filename: string, bytes: Buffer): void {
  response
    .status(200)
    .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    .header('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`)
    .send(bytes)
}

@Controller('projects/:projectId')
export class ImportExportController {
  constructor(private readonly importExport: ImportExportService) {}

  @Post('imports/build-materials')
  @UseInterceptors(FileInterceptor('file'))
  importBuildMaterials(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseIntPipe) projectId: number,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.importExport.importBuildMaterials(projectId, user.userId, this.fileBytes(file))
  }

  @Post('imports/transport-records')
  @UseInterceptors(FileInterceptor('file'))
  importTransportRecords(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseIntPipe) projectId: number,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.importExport.importTransportRecords(projectId, user.userId, this.fileBytes(file))
  }

  @Post('imports/construction-records')
  @UseInterceptors(FileInterceptor('file'))
  importConstructionRecords(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseIntPipe) projectId: number,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.importExport.importConstructionRecords(projectId, user.userId, this.fileBytes(file))
  }

  @Get('exports/build-materials')
  async exportBuildMaterials(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Res() response: Response,
  ) {
    const bytes = await this.importExport.exportBuildMaterials(projectId, user.userId)
    sendXlsx(response, '材料清单.xlsx', bytes)
  }

  @Get('exports/transport-records')
  async exportTransportRecords(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Res() response: Response,
  ) {
    const bytes = await this.importExport.exportTransportRecords(projectId, user.userId)
    sendXlsx(response, '运输记录清单.xlsx', bytes)
  }

  @Get('exports/construction-records')
  async exportConstructionRecords(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Res() response: Response,
  ) {
    const bytes = await this.importExport.exportConstructionRecords(projectId, user.userId)
    sendXlsx(response, '工程台班清单.xlsx', bytes)
  }

  private fileBytes(file?: Express.Multer.File): Buffer {
    if (!file?.buffer) {
      throw new BadRequestException('请上传Excel文件')
    }
    return file.buffer
  }
}