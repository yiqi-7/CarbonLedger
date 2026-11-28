import type { JwtModuleOptions } from '@nestjs/jwt'

const DEVELOPMENT_FALLBACK_SECRET = 'test-only-secret-change-before-deploy'
const MIN_PRODUCTION_SECRET_LENGTH = 32
const RELAXED_ENVIRONMENTS = new Set(['development', 'dev', 'test'])
const INSECURE_SECRETS = new Set([
  DEVELOPMENT_FALLBACK_SECRET,
  'secret',
  'password',
  'changeme',
  'change-me',
  'default',
  'jwt-secret',
  'your-secret',
  'replace-with-a-long-random-secret',
  'replace_with_a_long_random_secret',
])

type JwtExpiry = NonNullable<JwtModuleOptions['signOptions']>['expiresIn']

export interface JwtEnvironment {
  NODE_ENV?: string
  JWT_SECRET?: string
  JWT_EXPIRES_IN?: string
  JWT_ISSUER?: string
  JWT_AUDIENCE?: string
}

function environmentName(environment: JwtEnvironment): string {
  return environment.NODE_ENV?.trim().toLowerCase() ?? ''
}

function isWeakProductionSecret(secret: string): boolean {
  if (secret.length < MIN_PRODUCTION_SECRET_LENGTH || INSECURE_SECRETS.has(secret.toLowerCase())) return true
  if (/^(.)\1+$/.test(secret)) return true
  if (new Set(secret).size < 4) return true
  if (/(?:replace|change|default|example|sample|test-only|dev-only)/i.test(secret)) return true
  return false
}

function validateProductionSecret(secret: string | undefined): string {
  const normalized = secret?.trim()
  if (!normalized || isWeakProductionSecret(normalized)) {
    throw new Error(
      `JWT_SECRET must be a long, random value of at least ${MIN_PRODUCTION_SECRET_LENGTH} characters outside test/development environments`,
    )
  }
  return normalized
}

function parseExpiry(value: string | undefined): JwtExpiry {
  const normalized = value?.trim() || '12h'
  if (/^\d+$/.test(normalized)) {
    const seconds = Number(normalized)
    if (seconds > 0 && Number.isSafeInteger(seconds)) return seconds
  } else if (/^\d+(?:\.\d+)?[smhd]$/i.test(normalized) && Number.parseFloat(normalized) > 0) {
    return normalized as JwtExpiry
  }
  throw new Error('JWT_EXPIRES_IN must be a positive number of seconds or duration such as 12h')
}

function optionalClaim(value: string | undefined, name: string): string | undefined {
  const normalized = value?.trim()
  if (value !== undefined && !normalized) throw new Error(`${name} must not be empty when configured`)
  return normalized || undefined
}

export function createJwtOptions(environment: JwtEnvironment = process.env): JwtModuleOptions {
  const envName = environmentName(environment)
  const relaxed = RELAXED_ENVIRONMENTS.has(envName)
  const secret = relaxed
    ? environment.JWT_SECRET?.trim() || DEVELOPMENT_FALLBACK_SECRET
    : validateProductionSecret(environment.JWT_SECRET)
  const issuer = optionalClaim(environment.JWT_ISSUER, 'JWT_ISSUER')
  const audience = optionalClaim(environment.JWT_AUDIENCE, 'JWT_AUDIENCE')
  const expiresIn = parseExpiry(environment.JWT_EXPIRES_IN)

  return {
    global: true,
    secret,
    signOptions: {
      expiresIn,
      ...(issuer ? { issuer } : {}),
      ...(audience ? { audience } : {}),
    },
    verifyOptions: {
      ...(issuer ? { issuer } : {}),
      ...(audience ? { audience } : {}),
    },
  }
}

export { DEVELOPMENT_FALLBACK_SECRET, MIN_PRODUCTION_SECRET_LENGTH }
