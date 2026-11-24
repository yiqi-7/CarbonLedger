import { Controller, Get, Param, ParseIntPipe, Res } from '@nestjs/common'
import type { Response } from 'express'
import { ReportsService } from './reports.service'
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator'

function sendFile(response: Response, filename: string, contentType: string, bytes: Buffer): void {
  response
    .status(200)
    .header('Content-Type', contentType)
    .header('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`)
    .send(bytes)
}

@Controller('projects/:projectId/reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('current/excel')
  async currentExcel(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Res() response: Response,
  ) {
    const bytes = await this.reports.exportCurrentExcel(projectId, user.userId)
    sendFile(response, 'CarbonLedger-当前核算.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', bytes)
  }

  @Get('current/pdf')
  async currentPdf(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Res() response: Response,
  ) {
    const bytes = await this.reports.exportCurrentPdf(projectId, user.userId)
    sendFile(response, 'CarbonLedger-当前核算.pdf', 'application/pdf', bytes)
  }

  @Get(':versionId/excel')
  async excel(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('versionId', ParseIntPipe) versionId: number,
    @Res() response: Response,
  ) {
    const bytes = await this.reports.exportExcel(projectId, user.userId, versionId)
    sendFile(
      response,
      `CarbonLedger-v${versionId}.xlsx`,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      bytes,
    )
  }

  @Get(':versionId/pdf')
  async pdf(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('versionId', ParseIntPipe) versionId: number,
    @Res() response: Response,
  ) {
    const bytes = await this.reports.exportPdf(projectId, user.userId, versionId)
    sendFile(response, `CarbonLedger-v${versionId}.pdf`, 'application/pdf', bytes)
  }
}