import { randomUUID } from 'crypto'
import { IdGenerator } from '../application/id-generator'

export class UuidIdGenerator implements IdGenerator {
  next(): string {
    return randomUUID()
  }
}
