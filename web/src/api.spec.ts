import { afterEach, describe, expect, it, vi } from 'vitest'
import { AxiosError } from 'axios'
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

  it('preserves a renewed session when an old in-flight request later returns 401', async () => {
    let storedToken: string | null = 'expired-token'
    const removeItem = vi.fn(() => { storedToken = null })
    const dispatchEvent = vi.fn()
    vi.stubGlobal('localStorage', { getItem: () => storedToken, removeItem })
    vi.stubGlobal('window', { dispatchEvent })
    let rejectOldRequest!: () => void
    let markSent!: () => void
    const sent = new Promise<void>(resolve => { markSent = resolve })
    const request = api.get('/projects/42', {
      adapter: config => new Promise((_resolve, reject) => {
        expect(config.headers.get('Authorization')).toBe('Bearer expired-token')
        rejectOldRequest = () => reject(new AxiosError('Expired session', 'ERR_BAD_REQUEST', config, undefined, {
          status: 401, statusText: 'Unauthorized', data: {}, headers: {}, config,
        }))
        markSent()
      }),
    })
    await sent
    storedToken = 'newly-restored-token'
    const rejected = expect(request).rejects.toMatchObject({ response: { status: 401 } })
    rejectOldRequest()
    await rejected

    expect(storedToken).toBe('newly-restored-token')
    expect(removeItem).not.toHaveBeenCalled()
    expect(dispatchEvent).not.toHaveBeenCalled()
  })

  it('still invalidates the current session and requests login when its request returns 401', async () => {
    let storedToken: string | null = 'current-token'
    const removeItem = vi.fn(() => { storedToken = null })
    const dispatchEvent = vi.fn()
    vi.stubGlobal('localStorage', { getItem: () => storedToken, removeItem })
    vi.stubGlobal('window', { dispatchEvent })

    await expect(api.get('/projects/42', {
      adapter: async config => {
        throw new AxiosError('Expired session', 'ERR_BAD_REQUEST', config, undefined, {
          status: 401, statusText: 'Unauthorized', data: {}, headers: {}, config,
        })
      },
    })).rejects.toMatchObject({ response: { status: 401 } })

    expect(storedToken).toBeNull()
    expect(removeItem).toHaveBeenCalledWith('carbon-ledger-token')
    expect(dispatchEvent).toHaveBeenCalledOnce()
    expect(dispatchEvent.mock.calls[0][0].type).toBe('carbon-ledger-unauthorized')
  })
})
