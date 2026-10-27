import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule.register(),
  )
  app.set('trust proxy', 1)
  app.enableShutdownHooks()
  const port = Number(process.env.PORT ?? 3001)
  await app.listen(port, '0.0.0.0')
}

void bootstrap()
