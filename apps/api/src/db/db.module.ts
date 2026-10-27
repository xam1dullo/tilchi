import { type DynamicModule, Module } from '@nestjs/common'
import { DB, type Db, createDb, databaseUrl } from './client'

@Module({})
// biome-ignore lint/complexity/noStaticOnlyClass: Nest dynamic modules are classes with a static factory
export class DbModule {
  // Tests pass an in-process database; everything else connects with DATABASE_URL.
  static forRoot(db?: Db): DynamicModule {
    return {
      module: DbModule,
      global: true,
      providers: [
        {
          provide: DB,
          useFactory: () => db ?? createDb(databaseUrl(process.env)),
        },
      ],
      exports: [DB],
    }
  }
}
