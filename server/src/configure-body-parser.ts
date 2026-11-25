import type { NestExpressApplication } from '@nestjs/platform-express'

export function configureBodyParser(app: NestExpressApplication): void {
  // A customer model image may be 10MB; its base64 JSON representation is larger.
  app.useBodyParser('json', { limit: '20mb' })
}
