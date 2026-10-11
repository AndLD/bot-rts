import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import 'reflect-metadata'
import { AssembleDto, CraftDto, LearnDto, ResearchDto } from './factory.dto'

const id = '0b7b4b0e-7d3a-4f0e-9a52-0f0b9a1c2d3e'
const invalid = <T extends object>(type: new () => T, value: object) =>
  validateSync(plainToInstance(type, value)).map((error) => error.property)

describe('the factory DTOs', () => {
  it('accepts a craft order with or without a count, and rejects a bad one', () => {
    expect(invalid(CraftDto, { module: 'gun-class1' })).toEqual([])
    expect(invalid(CraftDto, { module: 'gun-class1', count: 5 })).toEqual([])
    expect(invalid(CraftDto, { module: '' })).toEqual(['module'])
    expect(invalid(CraftDto, { module: 'gun-class1', count: 0 })).toEqual(['count'])
    expect(invalid(CraftDto, { module: 'gun-class1', count: 101 })).toEqual(['count'])
    expect(invalid(CraftDto, { module: 'gun-class1', count: 1.5 })).toEqual(['count'])
  })

  it('accepts a research order and a blueprint id', () => {
    expect(invalid(ResearchDto, { module: 'scanner-class2' })).toEqual([])
    expect(invalid(ResearchDto, {})).toEqual(['module'])
    expect(invalid(LearnDto, { itemId: id })).toEqual([])
    expect(invalid(LearnDto, { itemId: 'x' })).toEqual(['itemId'])
  })

  it('accepts an assembly with parts and an optional label', () => {
    expect(invalid(AssembleDto, { partIds: [id] })).toEqual([])
    expect(invalid(AssembleDto, { label: 'Scout', partIds: [id] })).toEqual([])
    expect(invalid(AssembleDto, { partIds: [] })).toEqual(['partIds'])
    expect(invalid(AssembleDto, { partIds: ['x'] })).toEqual(['partIds'])
    expect(invalid(AssembleDto, { label: '', partIds: [id] })).toEqual(['label'])
    expect(invalid(AssembleDto, { partIds: Array(51).fill(id) })).toEqual(['partIds'])
  })
})
