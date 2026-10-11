import { Transform } from 'class-transformer'
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator'
import { NAME_PATTERN, PASSWORD_PATTERN } from '../../../../../lib/utils/validation'

const PASSWORD_MESSAGE =
  'password must have 6-20 characters, a digit, an uppercase and a lowercase Latin letter and a special character'

// Surrounding spaces in an email are a typo, not part of the address
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)

export class RegisterDto {
  @IsString()
  @Matches(NAME_PATTERN, { message: 'name must be a first and last name' })
  @MaxLength(100)
  name!: string

  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  email!: string

  @IsString()
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_MESSAGE })
  password!: string
}

export class LoginDto {
  @Transform(trim)
  @IsEmail()
  email!: string

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password!: string
}

export class TokenDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  token!: string
}

export class EmailDto {
  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  email!: string
}

export class ResetPasswordDto extends TokenDto {
  @IsString()
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_MESSAGE })
  password!: string
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  currentPassword!: string

  @IsString()
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_MESSAGE })
  newPassword!: string
}

export class PasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password!: string
}

export class ChangeEmailDto extends PasswordDto {
  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  newEmail!: string
}
