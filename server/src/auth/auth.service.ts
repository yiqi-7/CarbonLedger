import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcryptjs'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'
import { LoginDto } from './dto'

export interface LoginResult {
  accessToken: string
  user: { id: number; username: string; role: 'ADMIN' | 'USER' }
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly audit: AuditService,
  ) {}

  /** 登录：仅 APPROVED 账号可登录；失败提示统一，不暴露账号是否存在 */
  async login(dto: LoginDto): Promise<LoginResult> {
    const genericError = new UnauthorizedException('用户名或密码错误')
    const user = await this.prisma.user.findUnique({ where: { username: dto.username } })
    if (!user) {
      await this.audit.record(null, 'LOGIN_FAILED', 'USER', '', '用户不存在')
      throw genericError
    }
    const matches = await bcrypt.compare(dto.password, user.passwordHash)
    if (!matches) {
      await this.audit.record(user.id, 'LOGIN_FAILED', 'USER', String(user.id), '密码错误')
      throw genericError
    }
    if (user.status !== 'APPROVED') {
      await this.audit.record(user.id, 'LOGIN_BLOCKED', 'USER', String(user.id), `账号状态 ${user.status}`)
      throw new UnauthorizedException(
        user.status === 'PENDING'
          ? '账号正在等待管理员审批，暂时无法登录'
          : '账号申请已被拒绝，无法登录',
      )
    }

    const payload = { sub: user.id, username: user.username, role: user.role as 'ADMIN' | 'USER' }
    const accessToken = await this.jwtService.signAsync(payload)
    await this.audit.record(user.id, 'LOGIN_SUCCESS', 'USER', String(user.id), '')
    return {
      accessToken,
      user: { id: user.id, username: user.username, role: payload.role },
    }
  }

  async me(userId: number): Promise<{ id: number; username: string; role: string; status: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new UnauthorizedException('用户不存在')
    return { id: user.id, username: user.username, role: user.role, status: user.status }
  }
}