import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from './api'

describe('web API client', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('uses the local API prefix and configured timeout', () => {
    expect(api.defaults.baseURL).toBe('/api')
    expect(api.defaults.timeout).toBe(20000)
  })

  it('adds a bearer token from browser storage when available', async () => {
    vi.stubGlobal('localStorage', { getItem: () => 'token-123' })
    const config = await api.interceptors.request.handlers![0].fulfilled!({ headers: {} } as any)
    expect((config as any).headers.Authorization).toBe('Bearer token-123')
  })
})
