import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe, Logger } from '@nestjs/common'
import { AppModule } from './app.module'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bodyParser: true })
  app.setGlobalPrefix('api')
  app.enableCors({ origin: true, credentials: true })
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  )
  const port = Number(process.env.PORT ?? 3000)
  await app.listen(port, '0.0.0.0')
  Logger.log(`CarbonLedger API listening on http://localhost:${port}/api`, 'Bootstrap')
}

void bootstrap()