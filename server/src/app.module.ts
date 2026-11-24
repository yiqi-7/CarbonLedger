import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { PrismaModule } from './prisma/prisma.module'
import { HealthController } from './health/health.controller'
import { AuthModule } from './auth/auth.module'
import { UsersModule } from './users/users.module'
import { ProjectsModule } from './projects/projects.module'
import { RecordsModule } from './records/records.module'
import { VersionsModule } from './versions/versions.module'
import { AnalysisModule } from './analysis/analysis.module'
import { ImportExportModule } from './import-export/import-export.module'
import { ReportsModule } from './reports/reports.module'
import { AuditModule } from './audit/audit.module'
import { JwtAuthGuard } from './auth/jwt-auth.guard'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuditModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    RecordsModule,
    AnalysisModule,
    ImportExportModule,
    ReportsModule,
    VersionsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}