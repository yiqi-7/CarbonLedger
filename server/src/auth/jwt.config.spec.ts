import { describe, expect, it } from 'vitest'
import {
  createJwtOptions,
  DEVELOPMENT_FALLBACK_SECRET,
  MIN_PRODUCTION_SECRET_LENGTH,
} from './jwt.config'

describe('createJwtOptions', () => {
  it.each([
    { NODE_ENV: undefined, JWT_SECRET: undefined },
    { NODE_ENV: 'production', JWT_SECRET: undefined },
    { NODE_ENV: 'production', JWT_SECRET: DEVELOPMENT_FALLBACK_SECRET },
    { NODE_ENV: 'production', JWT_SECRET: 'short-secret' },
    { NODE_ENV: 'production', JWT_SECRET: 'a'.repeat(MIN_PRODUCTION_SECRET_LENGTH) },
    { NODE_ENV: 'staging', JWT_SECRET: 'replace-with-a-long-random-secret' },
  ])('rejects unsafe production-like configuration: $NODE_ENV / $JWT_SECRET', (environment) => {
    expect(() => createJwtOptions(environment)).toThrow(/JWT_SECRET/)
  })

  it('keeps explicit test and development environments usable', () => {
    expect(createJwtOptions({ NODE_ENV: 'test' }).secret).toBe(DEVELOPMENT_FALLBACK_SECRET)
    expect(createJwtOptions({ NODE_ENV: 'development', JWT_SECRET: 'local-secret' }).secret).toBe('local-secret')
  })

  it('validates expiry and applies issuer and audience consistently', () => {
    const options = createJwtOptions({
      NODE_ENV: 'production',
      JWT_SECRET: 'a sufficiently long random production secret 123!',
      JWT_EXPIRES_IN: '2h',
      JWT_ISSUER: 'carbon-ledger',
      JWT_AUDIENCE: 'carbon-ledger-web',
    })
    expect(options.signOptions).toMatchObject({ expiresIn: '2h', issuer: 'carbon-ledger', audience: 'carbon-ledger-web' })
    expect(options.verifyOptions).toMatchObject({ issuer: 'carbon-ledger', audience: 'carbon-ledger-web' })
    expect(() => createJwtOptions({ NODE_ENV: 'production', JWT_SECRET: 'a sufficiently long random production secret 123!', JWT_EXPIRES_IN: '0h' })).toThrow(/JWT_EXPIRES_IN/)
  })
})
