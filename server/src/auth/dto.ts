import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator'

export class LoginDto {
  @IsString()
  @IsNotEmpty({ message: '请输入用户名' })
  @MaxLength(50)
  username!: string

  @IsString()
  @IsNotEmpty({ message: '请输入密码' })
  @MaxLength(100)
  password!: string
}

export class RegisterDto {
  @IsString()
  @IsNotEmpty({ message: '请输入用户名' })
  @MinLength(3, { message: '用户名至少 3 个字符' })
  @MaxLength(50, { message: '用户名不能超过 50 个字符' })
  username!: string

  @IsString()
  @MinLength(6, { message: '密码至少 6 位' })
  @MaxLength(100, { message: '密码不能超过 100 位' })
  password!: string

  @IsString()
  @MaxLength(200, { message: '备注不能超过 200 个字符' })
  remark: string = ''
}