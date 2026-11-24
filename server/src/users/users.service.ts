import {
  ConflictException,
  Injectable,
  NotFoundException,
  Logger,
  OnModuleInit,
} from '@nestjs/common'
import * as bcrypt from 'bcryptjs'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'
import { RegisterDto } from '../auth/dto'

export interface UserSummary {
  id: number
  username: string
  remark: string
  role: string
  status: string
  createdAt: Date
}

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** 首位管理员初始化：由环境变量提供，不存在时才创建 */
  async onModuleInit(): Promise<void> {
    const username = process.env.ADMIN_USERNAME
    const password = process.env.ADMIN_PASSWORD
    if (!username || !password) {
      this.logger.warn('ADMIN_USERNAME / ADMIN_PASSWORD 未设置，跳过管理员初始化')
      return
    }
    const existing = await this.prisma.user.findUnique({ where: { username } })
    if (existing) return
    await this.prisma.user.create({
      data: {
        username,
        passwordHash: await bcrypt.hash(password, 10),
        remark: '系统初始化管理员',
        role: 'ADMIN',
        status: 'APPROVED',
      },
    })
    this.logger.log(`已创建初始管理员账号：${username}`)
  }

  /** 注册申请：用户名唯一（含待审批），密码 ≥6，备注 ≤200 */
  async register(dto: RegisterDto): Promise<{ id: number; username: string; status: string }> {
    const existing = await this.prisma.user.findUnique({ where: { username: dto.username } })
    if (existing) throw new ConflictException('该用户名已被使用')
    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        passwordHash: await bcrypt.hash(dto.password, 10),
        remark: dto.remark ?? '',
        role: 'USER',
        status: 'PENDING',
      },
    })
    await this.audit.record(user.id, 'REGISTER_SUBMITTED', 'USER', String(user.id), '提交注册申请')
    return { id: user.id, username: user.username, status: user.status }
  }

  /** 管理员：待审批列表 */
  async listPending(): Promise<UserSummary[]> {
    return this.prisma.user.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, username: true, remark: true, role: true, status: true, createdAt: true },
    })
  }

  /** 管理员：全部账号列表 */
  async listAll(): Promise<UserSummary[]> {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, username: true, remark: true, role: true, status: true, createdAt: true },
    })
  }

  /** 管理员：审批通过 */
  async approve(adminId: number, userId: number): Promise<UserSummary> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new NotFoundException('用户不存在')
    if (user.status !== 'PENDING') throw new ConflictException('该账号不在待审批状态')
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'APPROVED' },
      select: { id: true, username: true, remark: true, role: true, status: true, createdAt: true },
    })
    await this.audit.record(adminId, 'REGISTER_APPROVED', 'USER', String(userId), user.username)
    return updated
  }

  /** 管理员：拒绝申请 */
  async reject(adminId: number, userId: number): Promise<UserSummary> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new NotFoundException('用户不存在')
    if (user.status !== 'PENDING') throw new ConflictException('该账号不在待审批状态')
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'REJECTED' },
      select: { id: true, username: true, remark: true, role: true, status: true, createdAt: true },
    })
    await this.audit.record(adminId, 'REGISTER_REJECTED', 'USER', String(userId), user.username)
    return updated
  }
}