import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe, Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { AppModule } from './app.module'
import { configureCors } from './configure-cors'
import { configureBodyParser } from './configure-body-parser'
import { configureSecurity } from './configure-security'
import { configureRequestProtection } from './configure-request-protection'

async function bootstrap(): Promise<void> {
  // Install parsers explicitly below so auth routes can use a smaller body limit.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false })
  configureSecurity(app)
  app.setGlobalPrefix('api')
  configureRequestProtection(app)
  configureBodyParser(app)
  configureCors(app)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  )
  const port = Number(process.env.PORT ?? 3000)
  const host = process.env.HOST ?? '0.0.0.0'
  await app.listen(port, host)
  Logger.log(`CarbonLedger API listening on http://localhost:${port}/api`, 'Bootstrap')
}

void bootstrap()
