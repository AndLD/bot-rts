import { ValidationError as ClassValidationError } from 'class-validator'

// The messages of failed validation, including those of nested objects and lists (`children`)
export function validationMessages(errors: readonly ClassValidationError[], path = ''): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}).map((message) => (path ? `${path}${message}` : message)),
    ...validationMessages(error.children ?? [], `${path}${error.property}.`)
  ])
}
