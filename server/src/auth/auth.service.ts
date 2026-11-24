import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcryptjs'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'
import { LoginDto } from './dto'

export interface LoginResult {
  accessToken: string
  user: { id: number; username: string; role: 'ADMIN' | 'USER' }
}

type LoginAttempt = { count: number; windowStartedAt: number; blockedUntil: number }
const LOGIN_WINDOW_MS = 15 * 60 * 1000
const LOGIN_MAX_FAILURES = 5
const LOGIN_BLOCK_MS = 15 * 60 * 1000

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly audit: AuditService,
  ) {}

  private readonly attempts = new Map<string, LoginAttempt>()

  private key(username: string): string {
    return username.trim().toLocaleLowerCase()
  }

  private checkRateLimit(username: string): void {
    const attempt = this.attempts.get(this.key(username))
    if (attempt && attempt.blockedUntil > Date.now()) {
      throw new HttpException('登录失败次数过多，请稍后再试', HttpStatus.TOO_MANY_REQUESTS)
    }
    if (attempt && attempt.windowStartedAt + LOGIN_WINDOW_MS <= Date.now()) this.attempts.delete(this.key(username))
  }

  private registerFailure(username: string): void {
    const key = this.key(username)
    const now = Date.now()
    if (this.attempts.size >= 10_000 && !this.attempts.has(key)) {
      const oldest = this.attempts.keys().next().value
      if (oldest) this.attempts.delete(oldest)
    }
    const previous = this.attempts.get(key)
    const attempt = !previous || previous.windowStartedAt + LOGIN_WINDOW_MS <= now
      ? { count: 1, windowStartedAt: now, blockedUntil: 0 }
      : { ...previous, count: previous.count + 1 }
    if (attempt.count >= LOGIN_MAX_FAILURES) attempt.blockedUntil = now + LOGIN_BLOCK_MS
    this.attempts.set(key, attempt)
  }

  private clearFailures(username: string): void {
    this.attempts.delete(this.key(username))
  }

  /** 登录：仅 APPROVED 账号可登录；失败提示统一，不暴露账号是否存在 */
  async login(dto: LoginDto): Promise<LoginResult> {
    this.checkRateLimit(dto.username)
    const genericError = new UnauthorizedException('用户名或密码错误')
    const user = await this.prisma.user.findUnique({ where: { username: dto.username } })
    if (!user) {
      this.registerFailure(dto.username)
      await this.audit.record(null, 'LOGIN_FAILED', 'USER', '', '用户不存在')
      throw genericError
    }
    const matches = await bcrypt.compare(dto.password, user.passwordHash)
    if (!matches) {
      this.registerFailure(dto.username)
      await this.audit.record(user.id, 'LOGIN_FAILED', 'USER', String(user.id), '密码错误')
      throw genericError
    }
    if (user.status !== 'APPROVED') {
      this.registerFailure(dto.username)
      await this.audit.record(user.id, 'LOGIN_BLOCKED', 'USER', String(user.id), `账号状态 ${user.status}`)
      throw new UnauthorizedException(
        user.status === 'PENDING'
          ? '账号正在等待管理员审批，暂时无法登录'
          : '账号申请已被拒绝，无法登录',
      )
    }

    this.clearFailures(dto.username)
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