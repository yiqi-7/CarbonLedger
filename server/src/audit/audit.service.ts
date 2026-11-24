import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

export interface AuditEntry {
  id: number
  userId: number | null
  action: string
  targetType: string
  targetId: string
  detail: string
  result: string
  createdAt: Date
}

/** 关键操作审计（不记录密码、令牌等敏感信息，不记录核算明细） */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name)

  constructor(private readonly prisma: PrismaService) {}

  async record(
    userId: number | null,
    action: string,
    targetType: string,
    targetId = '',
    detail = '',
    result: 'SUCCESS' | 'FAILED' = 'SUCCESS',
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: { userId, action, targetType, targetId, detail: detail.slice(0, 500), result },
      })
    } catch (error) {
      // 审计失败不应阻断业务，但必须留下日志
      this.logger.error(`Failed to write audit log: ${action}`, error as Error)
    }
  }

  async list(limit = 100): Promise<AuditEntry[]> {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 500),
    })
  }
}