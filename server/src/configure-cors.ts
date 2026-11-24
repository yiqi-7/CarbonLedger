import type { INestApplication } from '@nestjs/common'

export function configureCors(app: Pick<INestApplication, 'enableCors'>, rawOrigins = process.env.CORS_ORIGINS ?? ''): void {
  const origins = rawOrigins.split(',').map(origin => origin.trim()).filter(Boolean)
  if (origins.length) app.enableCors({ origin: origins, credentials: false })
}
