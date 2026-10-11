import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { ListUsersQueryDto, UpdateUserDto } from '../../../users/presentation/dto/users.dto'
import { ChangeEmailDto, LoginDto, RegisterDto, ResetPasswordDto } from './auth.dto'

function errorsOf<T extends object>(type: new () => T, plain: object) {
  return validateSync(plainToInstance(type, plain), { whitelist: true, forbidNonWhitelisted: true }).map(
    (e) => e.property
  )
}

const valid = { name: 'Alice', email: 'alice@example.com', password: 'Passw0rd!x' }

describe('auth DTOs', () => {
  it('accept valid input and trim the email', () => {
    expect(errorsOf(RegisterDto, valid)).toEqual([])
    expect(plainToInstance(RegisterDto, { ...valid, email: '  alice@example.com ' }).email).toBe('alice@example.com')
    expect(errorsOf(LoginDto, { email: 'a@b.co', password: 'x' })).toEqual([])
  })

  it('reject a weak password, a bad name, a bad email and extra fields', () => {
    expect(errorsOf(RegisterDto, { ...valid, password: 'weak' })).toEqual(['password'])
    expect(errorsOf(RegisterDto, { ...valid, name: 'alice' })).toEqual(['name'])
    expect(errorsOf(RegisterDto, { ...valid, email: 'nope' })).toEqual(['email'])
    expect(errorsOf(RegisterDto, { ...valid, status: 'owner' })).toEqual(['status'])
  })

  it('leave a non-string email to the validator instead of trimming it', () => {
    expect(errorsOf(LoginDto, { email: 5, password: 'x' })).toEqual(['email'])
  })

  it('check tokens and the new password of a reset, and the target of an email change', () => {
    expect(errorsOf(ResetPasswordDto, { token: 'abc', password: 'Passw0rd!x' })).toEqual([])
    expect(errorsOf(ResetPasswordDto, { token: '', password: 'weak' }).sort()).toEqual(['password', 'token'])
    expect(errorsOf(ChangeEmailDto, { password: 'x', newEmail: 'bad' })).toEqual(['newEmail'])
  })
})

describe('users DTOs', () => {
  it('use pagination defaults and convert query strings', () => {
    const query = plainToInstance(ListUsersQueryDto, {})
    expect([query.page, query.results]).toEqual([1, 10])

    const parsed = plainToInstance(ListUsersQueryDto, { page: '2', results: '5', active: 'true', status: 'admin' })
    expect(parsed).toMatchObject({ page: 2, results: 5, active: true, status: 'admin' })
    expect(plainToInstance(ListUsersQueryDto, { active: 'false' }).active).toBe(false)
    expect(errorsOf(ListUsersQueryDto, { page: '2', active: 'true' })).toEqual([])
  })

  it('reject out-of-range, unknown and malformed query values', () => {
    expect(errorsOf(ListUsersQueryDto, { page: '0' })).toEqual(['page'])
    expect(errorsOf(ListUsersQueryDto, { results: '1000' })).toEqual(['results'])
    expect(errorsOf(ListUsersQueryDto, { status: 'root' })).toEqual(['status'])
    expect(errorsOf(ListUsersQueryDto, { active: 'yes' })).toEqual(['active'])
    expect(errorsOf(ListUsersQueryDto, { email: 'x' })).toEqual(['email'])
  })

  it('whitelist the fields of a user update', () => {
    expect(errorsOf(UpdateUserDto, { name: 'Bobby', subscription: 'yearly', status: 'user' })).toEqual([])
    expect(errorsOf(UpdateUserDto, {})).toEqual([])
    expect(errorsOf(UpdateUserDto, { email: 'x@y.zz' })).toEqual(['email'])
    expect(errorsOf(UpdateUserDto, { name: 'bobby', subscription: 'gold' }).sort()).toEqual(['name', 'subscription'])
  })
})
