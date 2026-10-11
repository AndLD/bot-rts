import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import 'reflect-metadata'
import { ListBotsQueryDto } from './bots.dto'

describe('ListBotsQueryDto', () => {
  it('accepts no filter and a known bot type, rejects anything else', () => {
    expect(validateSync(plainToInstance(ListBotsQueryDto, {}))).toEqual([])
    expect(validateSync(plainToInstance(ListBotsQueryDto, { type: 'base' }))).toEqual([])
    expect(validateSync(plainToInstance(ListBotsQueryDto, { type: 'tank' })).map((e) => e.property)).toEqual(['type'])
  })
})
