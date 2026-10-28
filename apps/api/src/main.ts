import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { AppModule } from './app.module'
import { readBootstrapConfig } from './config'

async function bootstrap() {
  const result = readBootstrapConfig(process.env)
  if (!result.ok) {
    for (const error of result.errors) console.error(`config: ${error}`)
    process.exit(1)
  }
  const app = await NestFactory.create<NestExpressApplication>(AppModule)
  app.set('trust proxy', 1)
  app.enableShutdownHooks()
  await app.listen(result.config.port, '0.0.0.0')
}

void bootstrap()
