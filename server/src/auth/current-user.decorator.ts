import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { Request } from 'express'

/** JWT 载荷（由 JwtStrategy 校验后挂到 request.user） */
export interface AuthUser {
  userId: number
  username: string
  role: 'ADMIN' | 'USER'
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => {
    const request = context.switchToHttp().getRequest<Request & { user: AuthUser }>()
    return request.user
  },
)