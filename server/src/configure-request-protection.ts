import express, { type NextFunction, type Request, type RequestHandler, type Response } from 'express'
import type { NestExpressApplication } from '@nestjs/platform-express'

export interface RateLimitOptions {
  windowMs: number
  limit: number
  message?: string
  now?: () => number
  endpoint?: 'login' | 'register'
}

type Bucket = { count: number; resetAt: number }

const DEFAULT_LOGIN_LIMIT = 30
const DEFAULT_REGISTER_LIMIT = 20
const DEFAULT_AUTH_WINDOW_MS = 15 * 60 * 1000
const DEFAULT_REGISTER_WINDOW_MS = 60 * 60 * 1000
const DEFAULT_REQUEST_TIMEOUT_MS = 30 * 1000
const MAX_BUCKETS = 20_000

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function clientIp(request: Request): string {
  return request.ip || request.socket.remoteAddress || 'unknown'
}

function authEndpoint(request: Request): 'login' | 'register' | undefined {
  if (request.method !== 'POST') return undefined
  if (request.path === '/api/auth/login' || request.path === '/auth/login') return 'login'
  if (request.path === '/api/auth/register' || request.path === '/auth/register') return 'register'
  return undefined
}

function sendTooManyRequests(response: Response, resetAt: number, message: string, now: () => number): void {
  const retryAfter = Math.max(1, Math.ceil((resetAt - now()) / 1000))
  response.setHeader('Retry-After', String(retryAfter))
  response.status(429).json({ statusCode: 429, message })
}

/**
 * Small process-local fixed-window limiter for the public auth endpoints.
 * Username lockout remains in AuthService; this layer limits distributed
 * guessing and registration bursts by the request's trusted client IP.
 */
export function createAuthRateLimiter(options: RateLimitOptions): RequestHandler {
  const now = options.now ?? Date.now
  const buckets = new Map<string, Bucket>()
  const message = options.message ?? '请求过于频繁，请稍后再试'

  return (request: Request, response: Response, next: NextFunction) => {
    const endpoint = authEndpoint(request)
    if (!endpoint || (options.endpoint && endpoint !== options.endpoint)) {
      next()
      return
    }

    const key = `${endpoint}:${clientIp(request)}`
    const current = now()
    let bucket = buckets.get(key)
    if (!bucket || bucket.resetAt <= current) {
      if (buckets.size >= MAX_BUCKETS && !buckets.has(key)) buckets.delete(buckets.keys().next().value as string)
      bucket = { count: 0, resetAt: current + options.windowMs }
      buckets.set(key, bucket)
    }

    bucket.count += 1
    const remaining = Math.max(0, options.limit - bucket.count)
    response.setHeader('RateLimit-Limit', String(options.limit))
    response.setHeader('RateLimit-Remaining', String(remaining))
    response.setHeader('RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)))
    if (bucket.count > options.limit) {
      // Do not leave a rejected request body flowing into the next parser.
      request.resume?.()
      sendTooManyRequests(response, bucket.resetAt, message, now)
      return
    }
    next()
  }
}

/**
 * Bounds time spent waiting for a handler to produce a response. The timer is
 * cleared when the response completes, and can be overridden for tests or
 * deployments through REQUEST_TIMEOUT_MS.
 */
export function createRequestTimeout(timeoutMs: number): RequestHandler {
  return (request: Request, response: Response, next: NextFunction) => {
    let finished = false
    const timer = setTimeout(() => {
      if (finished || response.headersSent) return
      response.status(408).json({ statusCode: 408, message: '请求处理超时' })
    }, timeoutMs)
    const clear = () => {
      finished = true
      clearTimeout(timer)
    }
    response.once('finish', clear)
    response.once('close', clear)
    next()
  }
}

export function configureRequestProtection(app: NestExpressApplication): void {
  const loginLimit = positiveInteger(process.env.AUTH_LOGIN_RATE_LIMIT, DEFAULT_LOGIN_LIMIT)
  const registerLimit = positiveInteger(process.env.AUTH_REGISTER_RATE_LIMIT, DEFAULT_REGISTER_LIMIT)
  const authWindowMs = positiveInteger(process.env.AUTH_RATE_WINDOW_MS, DEFAULT_AUTH_WINDOW_MS)
  const registerWindowMs = positiveInteger(process.env.AUTH_REGISTER_RATE_WINDOW_MS, DEFAULT_REGISTER_WINDOW_MS)
  const timeoutMs = positiveInteger(process.env.REQUEST_TIMEOUT_MS, DEFAULT_REQUEST_TIMEOUT_MS)

  app.use(createAuthRateLimiter({ windowMs: authWindowMs, limit: loginLimit, endpoint: 'login' }))
  app.use(createAuthRateLimiter({ windowMs: registerWindowMs, limit: registerLimit, endpoint: 'register' }))
  app.use(createRequestTimeout(timeoutMs))
  // Auth payloads never need the 20 MB customer image budget.
  app.use('/api/auth/login', express.json({ limit: '16kb' }))
  app.use('/api/auth/register', express.json({ limit: '16kb' }))
}

export const requestProtectionDefaults = {
  loginLimit: DEFAULT_LOGIN_LIMIT,
  registerLimit: DEFAULT_REGISTER_LIMIT,
  authWindowMs: DEFAULT_AUTH_WINDOW_MS,
  registerWindowMs: DEFAULT_REGISTER_WINDOW_MS,
  requestTimeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
} as const
