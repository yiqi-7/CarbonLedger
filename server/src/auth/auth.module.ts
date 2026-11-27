import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { AuditModule } from '../audit/audit.module'

const jwtSecret = process.env.JWT_SECRET ?? (process.env.NODE_ENV === 'production'
  ? (() => { throw new Error('JWT_SECRET must be set in production') })()
  : 'test-only-secret-change-before-deploy')

@Module({
  imports: [
    AuditModule,
    JwtModule.register({
      global: true,
      secret: jwtSecret,
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN ?? '12h') as `${number}h` },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}