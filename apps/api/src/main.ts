import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { AppModule } from './app.module'
import { productionConfigErrors } from './config'

async function bootstrap() {
  const errors = productionConfigErrors(process.env)
  if (errors.length > 0) {
    for (const error of errors) console.error(`config: ${error}`)
    process.exit(1)
  }
  const app = await NestFactory.create<NestExpressApplication>(AppModule)
  app.set('trust proxy', 1)
  app.enableShutdownHooks()
  const port = Number(process.env.PORT ?? 3001)
  await app.listen(port, '0.0.0.0')
}

void bootstrap()
