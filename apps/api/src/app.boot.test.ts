import { Test } from '@nestjs/testing'
import { describe, expect, it } from 'vitest'
import { AppModule } from './app.module'
import { AuthService } from './auth/auth.service'

describe('AppModule boot', () => {
  it('compiles and resolves AuthService as a value token', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()
    const auth = moduleRef.get(AuthService)
    expect(auth).toBeInstanceOf(AuthService)
    await moduleRef.close()
  })
})
