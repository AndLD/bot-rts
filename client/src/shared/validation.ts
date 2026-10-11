import { Rule } from 'antd/lib/form'
import { NAME_PATTERN, PASSWORD_PATTERN } from '@lib/utils/validation'

interface IValidationRules {
  [key: string]: (message?: string) => Rule
}

export const validationRules: IValidationRules = {
  NAME: (message) => ({
    pattern: NAME_PATTERN,
    message: message || 'Невірні ім`я та прізвище'
  }),
  REQUIRED: (message) => ({
    required: true,
    message: message || "Поле є обов'язковим"
  }),
  EMAIL: (message) => ({
    type: 'email',
    message: message || 'Невірний email'
  }),
  PASSWORD: (message) => ({
    pattern: PASSWORD_PATTERN,
    message: message || 'Невірний пароль'
  })
}
