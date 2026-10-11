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

// The access password of a bot or base (design §11.2.2): others need it to connect, so it is short and typed in a terminal
export const BOT_PASSWORD_MIN_LENGTH = 6
export const BOT_PASSWORD_MAX_LENGTH = 64

export function isValidBotPassword(value: string): boolean {
  return value.length >= BOT_PASSWORD_MIN_LENGTH && value.length <= BOT_PASSWORD_MAX_LENGTH
}
