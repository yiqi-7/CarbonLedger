import { describe, expect, it, vi } from 'vitest'
import type { INestApplication } from '@nestjs/common'
import { configureCors } from './configure-cors'

describe('configureCors', () => {
  it('does not enable cross-origin access by default', () => {
    const enableCors = vi.fn()
    configureCors({ enableCors } as unknown as Pick<INestApplication, 'enableCors'>, '')
    expect(enableCors).not.toHaveBeenCalled()
  })

  it('allows only explicit origins without credential cookies', () => {
    const enableCors = vi.fn()
    configureCors({ enableCors } as unknown as Pick<INestApplication, 'enableCors'>, 'https://app.example, https://admin.example ')
    expect(enableCors).toHaveBeenCalledWith({
      origin: ['https://app.example', 'https://admin.example'],
      credentials: false,
    })
  })
})
