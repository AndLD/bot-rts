import { ApiProperty } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator'
import { PRIVACY_POLICY_VERSION } from '../../../../../lib/utils/privacy'
import { NAME_PATTERN, PASSWORD_PATTERN } from '../../../../../lib/utils/validation'

const PASSWORD_MESSAGE =
  'password must have 6-20 characters, a digit, an uppercase and a lowercase Latin letter and a special character'

// Surrounding spaces in an email are a typo, not part of the address
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)

export class RegisterDto {
  @IsString()
  @Matches(NAME_PATTERN, { message: 'name must be a first and last name' })
  @MaxLength(100)
  @ApiProperty({ maxLength: 100, description: 'First and last name' })
  name!: string

  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  @ApiProperty({ format: 'email' })
  email!: string

  @IsString()
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_MESSAGE })
  @ApiProperty()
  password!: string

  @IsString()
  @MaxLength(32)
  @ApiProperty({
    description: 'The version of the privacy policy the player accepted',
    example: PRIVACY_POLICY_VERSION
  })
  acceptedPrivacyVersion!: string
}

export class LoginDto {
  @Transform(trim)
  @IsEmail()
  @ApiProperty({ format: 'email' })
  email!: string

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @ApiProperty()
  password!: string
}

export class TokenDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @ApiProperty()
  token!: string
}

export class EmailDto {
  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  @ApiProperty({ format: 'email' })
  email!: string
}

export class ResetPasswordDto extends TokenDto {
  @IsString()
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_MESSAGE })
  @ApiProperty()
  password!: string
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @ApiProperty()
  currentPassword!: string

  @IsString()
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_MESSAGE })
  @ApiProperty()
  newPassword!: string
}

export class PasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @ApiProperty()
  password!: string
}

export class ChangeEmailDto extends PasswordDto {
  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  @ApiProperty({ format: 'email' })
  newEmail!: string
}
