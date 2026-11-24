import { Controller, Get } from '@nestjs/common'
import { Public } from '../auth/public.decorator'

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check(): { status: string; service: string; time: string } {
    return { status: 'ok', service: 'carbon-ledger-api', time: new Date().toISOString() }
  }
}