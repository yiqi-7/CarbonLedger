import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { AuditModule } from '../audit/audit.module'

const jwtSecret = process.env.JWT_SECRET ?? 'carbon-ledger-dev-secret-please-change'

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