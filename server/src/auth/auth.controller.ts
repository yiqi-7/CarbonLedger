import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common'
import { AuthService } from './auth.service'
import { LoginDto } from './dto'
import { Public } from './public.decorator'
import { CurrentUser, type AuthUser } from './current-user.decorator'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto)
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user.userId)
  }
}