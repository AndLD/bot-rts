import { ValidationError } from 'class-validator'
import { validationMessages } from './validation-messages'

const error = (property: string, constraints?: Record<string, string>, children?: ValidationError[]) =>
  ({ property, constraints, children }) as ValidationError

describe('validationMessages', () => {
  it('lists the messages of flat properties', () => {
    expect(validationMessages([error('a', { x: 'a is bad', y: 'a is odd' }), error('b', { x: 'b is bad' })])).toEqual([
      'a is bad',
      'a is odd',
      'b is bad'
    ])
  })

  it('goes into nested objects and lists, naming the path', () => {
    const nested = error('stacks', undefined, [
      error('0', undefined, [error('amount', { isPositive: 'amount must be positive' })])
    ])

    expect(validationMessages([nested])).toEqual(['stacks.0.amount must be positive'])
  })

  it('has nothing to say about nothing', () => {
    expect(validationMessages([])).toEqual([])
    expect(validationMessages([error('a')])).toEqual([])
  })
})
