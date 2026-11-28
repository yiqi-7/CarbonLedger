import { describe, expect, it, vi } from 'vitest'
import { configureSecurity, securityHeadersMiddleware } from './configure-security'

function responseMock() {
  const headers = new Map<string, string>()
  return {
    setHeader: vi.fn((name: string, value: string) => headers.set(name, value)),
    headers,
  }
}

describe('security headers', () => {
  it('adds safe API response headers without requiring helmet', () => {
    const response = responseMock()
    const next = vi.fn()
    securityHeadersMiddleware({ secure: false } as never, response as never, next)

    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(response.headers.get('X-Frame-Options')).toBe('DENY')
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer')
    expect(response.headers.get('Permissions-Policy')).toBe('camera=(), microphone=(), geolocation=()')
    expect(response.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'")
    expect(response.headers.get('Content-Security-Policy')).not.toContain('default-src')
    expect(response.headers.has('Strict-Transport-Security')).toBe(false)
    expect(next).toHaveBeenCalledOnce()
  })

  it('adds HSTS only when the request is already HTTPS', () => {
    const response = responseMock()
    securityHeadersMiddleware({ secure: true } as never, response as never, vi.fn())
    expect(response.headers.get('Strict-Transport-Security')).toBe('max-age=31536000; includeSubDomains')
  })

  it('configures an explicitly requested trusted proxy without changing defaults', () => {
    const set = vi.fn()
    const disable = vi.fn()
    const use = vi.fn()
    const app = { set, disable, use } as never
    const previous = process.env.TRUST_PROXY
    process.env.TRUST_PROXY = '1'
    try {
      configureSecurity(app)
      expect(set).toHaveBeenCalledWith('trust proxy', 1)
      expect(disable).toHaveBeenCalledWith('x-powered-by')
      expect(use).toHaveBeenCalledWith(securityHeadersMiddleware)
    } finally {
      if (previous === undefined) delete process.env.TRUST_PROXY
      else process.env.TRUST_PROXY = previous
    }
  })
})
