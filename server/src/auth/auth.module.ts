import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { AuditModule } from '../audit/audit.module'
import { createJwtOptions, type JwtEnvironment } from './jwt.config'

@Module({
  imports: [
    AuditModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => createJwtOptions({
        NODE_ENV: config.get<string>('NODE_ENV'),
        JWT_SECRET: config.get<string>('JWT_SECRET'),
        JWT_EXPIRES_IN: config.get<string>('JWT_EXPIRES_IN'),
        JWT_ISSUER: config.get<string>('JWT_ISSUER'),
        JWT_AUDIENCE: config.get<string>('JWT_AUDIENCE'),
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}