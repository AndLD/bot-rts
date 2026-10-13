import { NAME_PATTERN, PASSWORD_PATTERN, PASSWORD_SPECIAL_CHARACTERS } from '@lib/utils/validation'
import { Rule } from 'antd/lib/form'
import { useTranslations } from 'next-intl'

// The form rules of the auth forms, with messages in the player's language
export function useAuthRules() {
  const t = useTranslations('auth.validation')

  return {
    nameRequired: { required: true, message: t('nameRequired') } satisfies Rule,
    name: { pattern: NAME_PATTERN, message: t('nameInvalid') } satisfies Rule,
    emailRequired: { required: true, message: t('emailRequired') } satisfies Rule,
    email: { type: 'email', message: t('emailInvalid') } satisfies Rule,
    privacyRequired: {
      validator: (_rule: unknown, value: unknown) =>
        value === true ? Promise.resolve() : Promise.reject(new Error(t('privacyRequired')))
    } satisfies Rule,
    passwordRequired: { required: true, message: t('passwordRequired') } satisfies Rule,
    password: {
      pattern: PASSWORD_PATTERN,
      message: t('passwordInvalid', { characters: PASSWORD_SPECIAL_CHARACTERS })
    } satisfies Rule
  }
}
