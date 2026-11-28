import { Injectable, ServiceUnavailableException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

const READINESS_TIMEOUT_MS = 500

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async readiness(): Promise<{ status: string; service: string; checks: { database: string }; time: string }> {
    let timeout: ReturnType<typeof setTimeout> | undefined
    try {
      const query = this.prisma.$queryRaw`SELECT 1`
      await Promise.race([
        query,
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error('database readiness probe timed out')), READINESS_TIMEOUT_MS)
        }),
      ])
      return {
        status: 'ok',
        service: 'carbon-ledger-api',
        checks: { database: 'ok' },
        time: new Date().toISOString(),
      }
    } catch {
      throw new ServiceUnavailableException({
        statusCode: 503,
        error: 'Service Unavailable',
        message: 'Database is not ready',
        checks: { database: 'failed' },
      })
    } finally {
      if (timeout) clearTimeout(timeout)
    }
  }
}
