import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Request, Response } from 'express'
import { configureRequestProtection, createAuthRateLimiter, createRequestTimeout } from './configure-request-protection'

function invoke(handler: ReturnType<typeof createAuthRateLimiter>, path: string, ip: string) {
  const headers = new Map<string, string>()
  const response = {
    setHeader: (name: string, value: string) => headers.set(name, value),
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) { this.statusCode = code; return this },
    json(body: unknown) { this.body = body; return this },
  }
  const next = vi.fn()
  handler({ method: 'POST', path, ip, socket: {}, resume: vi.fn() } as unknown as Request, response as unknown as Response, next)
  return { response, headers, next }
}

afterEach(() => vi.useRealTimers())

describe('auth request protection', () => {
  it('limits each IP and endpoint independently and emits useful retry headers', () => {
    let now = 1_000
    const limiter = createAuthRateLimiter({ windowMs: 10_000, limit: 2, now: () => now })
    expect(invoke(limiter, '/api/auth/login', '192.0.2.1').response.statusCode).toBe(200)
    const second = invoke(limiter, '/api/auth/login', '192.0.2.1')
    expect(second.headers.get('RateLimit-Remaining')).toBe('0')
    const blocked = invoke(limiter, '/api/auth/login', '192.0.2.1')
    expect(blocked.response.statusCode).toBe(429)
    expect(blocked.headers.get('Retry-After')).toBe('10')
    expect(blocked.next).not.toHaveBeenCalled()
    expect(invoke(limiter, '/api/auth/login', '192.0.2.2').response.statusCode).toBe(200)
    expect(invoke(limiter, '/api/auth/register', '192.0.2.1').response.statusCode).toBe(200)
    now += 10_000
    expect(invoke(limiter, '/api/auth/login', '192.0.2.1').response.statusCode).toBe(200)
  })

  it('does not count unrelated routes, methods, or an unmatched configured endpoint', () => {
    const limiter = createAuthRateLimiter({ windowMs: 1_000, limit: 1, endpoint: 'register' })
    expect(invoke(limiter, '/api/auth/login', '192.0.2.1').next).toHaveBeenCalledOnce()
    expect(invoke(limiter, '/api/projects', '192.0.2.1').next).toHaveBeenCalledOnce()
  })

  it('returns 408 when a request handler has not completed before timeout', () => {
    vi.useFakeTimers()
    const response = Object.assign(new EventEmitter(), {
      headersSent: false,
      statusCode: 200,
      body: undefined as unknown,
      status(code: number) { this.statusCode = code; return this },
      json(body: unknown) { this.body = body; return this },
    })
    const next = vi.fn()
    createRequestTimeout(50)({} as Request, response as unknown as Response, next)
    expect(next).toHaveBeenCalledOnce()
    vi.advanceTimersByTime(50)
    expect(response.statusCode).toBe(408)
    expect(response.body).toEqual({ statusCode: 408, message: '请求处理超时' })
    response.emit('finish')
  })

  it('registers endpoint-scoped policies and a configurable timeout in bootstrap', () => {
    const use = vi.fn()
    configureRequestProtection({ use } as never)
    expect(use).toHaveBeenCalledTimes(5)
    expect(typeof use.mock.calls[2][0]).toBe('function')
    expect(use.mock.calls[3][0]).toBe('/api/auth/login')
    expect(use.mock.calls[4][0]).toBe('/api/auth/register')
  })
})
