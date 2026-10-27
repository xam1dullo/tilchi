import { Logger, Module } from '@nestjs/common'
import { RoleAllowlist } from './roles'
import { UsersRepository } from './users.repository'

@Module({
  providers: [
    UsersRepository,
    {
      provide: RoleAllowlist,
      useFactory: () =>
        RoleAllowlist.fromEnv(process.env, (message) =>
          new Logger('RoleAllowlist').warn(message),
        ),
    },
  ],
  exports: [UsersRepository, RoleAllowlist],
})
export class UsersModule {}
