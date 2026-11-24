import { SetMetadata } from '@nestjs/common'

export const ROLES_KEY = 'roles'

/** 限制仅指定角色可访问（配合 RolesGuard 使用） */
export const Roles = (...roles: ('ADMIN' | 'USER')[]) => SetMetadata(ROLES_KEY, roles)