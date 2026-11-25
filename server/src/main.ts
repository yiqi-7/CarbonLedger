import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe, Logger } from '@nestjs/common'
import { AppModule } from './app.module'
import { configureCors } from './configure-cors'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bodyParser: true })
  app.setGlobalPrefix('api')
  configureCors(app)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  )
  const port = Number(process.env.PORT ?? 3000)
  const host = process.env.HOST ?? '0.0.0.0'
  await app.listen(port, host)
  Logger.log(`CarbonLedger API listening on http://localhost:${port}/api`, 'Bootstrap')
}

void bootstrap()