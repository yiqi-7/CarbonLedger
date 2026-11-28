import { describe, expect, it, vi } from 'vitest'
import { ServiceUnavailableException } from '@nestjs/common'
import { HealthController } from './health.controller'
import { HealthService } from './health.service'

function controllerWith(queryRaw: () => Promise<unknown>): HealthController {
  return new HealthController(new HealthService({ $queryRaw: queryRaw } as never))
}

describe('HealthController', () => {
  it('keeps the liveness response available without a database query', () => {
    const controller = controllerWith(vi.fn())
    expect(controller.check()).toMatchObject({ status: 'ok', service: 'carbon-ledger-api' })
  })

  it('reports readiness when the bounded database probe succeeds', async () => {
    const queryRaw = vi.fn().mockResolvedValue([{ 1: 1 }])
    const result = await controllerWith(queryRaw).readiness()
    expect(result).toMatchObject({ status: 'ok', checks: { database: 'ok' } })
    expect(queryRaw).toHaveBeenCalledOnce()
  })

  it('fails readiness when the database probe fails', async () => {
    const controller = controllerWith(vi.fn().mockRejectedValue(new Error('database unavailable')))
    await expect(controller.readiness()).rejects.toBeInstanceOf(ServiceUnavailableException)
  })
})
