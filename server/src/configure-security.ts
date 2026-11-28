import type { Request, RequestHandler, Response } from 'express'
import type { NestExpressApplication } from '@nestjs/platform-express'

/**
 * Safe response headers for an API. HSTS is emitted only for HTTPS requests so
 * local HTTP development and test environments are not pinned to HTTPS.
 */
export const securityHeadersMiddleware: RequestHandler = (request: Request, response: Response, next) => {
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('X-Frame-Options', 'DENY')
  response.setHeader('Referrer-Policy', 'no-referrer')
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  // This API does not serve the Vue shell. Keep CSP scoped to framing/base URLs so
  // same-origin app assets and inline Vue resources are not affected.
  response.setHeader('Content-Security-Policy', "frame-ancestors 'none'; base-uri 'self'")
  if (request.secure) response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  next()
}

function configureTrustProxy(app: NestExpressApplication): void {
  const configured = process.env.TRUST_PROXY?.trim()
  if (!configured) return
  if (configured === 'true') {
    app.set('trust proxy', true)
    return
  }
  if (configured === 'false') {
    app.set('trust proxy', false)
    return
  }
  const hops = Number(configured)
  if (Number.isInteger(hops) && hops >= 0) app.set('trust proxy', hops)
}

export function configureSecurity(app: NestExpressApplication): void {
  configureTrustProxy(app)
  app.disable('x-powered-by')
  app.use(securityHeadersMiddleware)
}
