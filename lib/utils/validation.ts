// Validation rules shared by the API and the client (one source of truth)

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// "Firstname Lastname": a capitalised Latin or Cyrillic word
export const NAME_PATTERN = /([A-Z][a-z\-']{1,50})|([А-ЯЁІЇҐЄ][а-яёіїґє\-']{1,50})/

export const PASSWORD_SPECIAL_CHARACTERS = '-#$.%&@(){}[]!?+*'

// 6–20 characters with a digit, an uppercase and a lowercase Latin letter and one special character
export const PASSWORD_PATTERN = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[-#$.%&@(){}[\]!?+*]).{6,20}$/

export function isValidName(value: string): boolean {
  return NAME_PATTERN.test(value)
}

export function isValidPassword(value: string): boolean {
  return PASSWORD_PATTERN.test(value)
}
