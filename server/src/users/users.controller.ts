import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common'
import { UsersService } from './users.service'
import { RegisterDto } from '../auth/dto'
import { Public } from '../auth/public.decorator'
import { Roles } from '../auth/roles.decorator'
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator'

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** 公开：提交注册申请 */
  @Public()
  @Post('auth/register')
  register(@Body() dto: RegisterDto) {
    return this.usersService.register(dto)
  }

  /** 管理员：待审批列表 */
  @Roles('ADMIN')
  @Get('admin/users/pending')
  pending() {
    return this.usersService.listPending()
  }

  /** 管理员：全部账号 */
  @Roles('ADMIN')
  @Get('admin/users')
  all() {
    return this.usersService.listAll()
  }

  /** 管理员：批准 */
  @Roles('ADMIN')
  @Post('admin/users/:id/approve')
  approve(@CurrentUser() admin: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.usersService.approve(admin.userId, id)
  }

  /** 管理员：拒绝 */
  @Roles('ADMIN')
  @Post('admin/users/:id/reject')
  reject(@CurrentUser() admin: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.usersService.reject(admin.userId, id)
  }
}