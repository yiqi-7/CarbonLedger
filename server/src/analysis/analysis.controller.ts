import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common'
import { AnalysisService } from './analysis.service'
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator'

@Controller('projects/:projectId/analysis')
export class AnalysisController {
  constructor(private readonly analysis: AnalysisService) {}

  /** 项目全量汇总（碳排分析 + 成本分析，旧版口径） */
  @Get()
  async summary(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseIntPipe) projectId: number,
  ) {
    const bundle = await this.analysis.buildBundle(projectId, user.userId)
    return bundle.summary
  }
}