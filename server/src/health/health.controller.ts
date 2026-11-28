import { Controller, Get } from '@nestjs/common'
import { Public } from '../auth/public.decorator'
import { HealthService } from './health.service'

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Public()
  @Get()
  check(): { status: string; service: string; time: string } {
    return { status: 'ok', service: 'carbon-ledger-api', time: new Date().toISOString() }
  }

  @Public()
  @Get('ready')
  readiness() {
    return this.health.readiness()
  }
}
