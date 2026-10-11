import { MAX_PAGE_SIZE, parseUsersQuery } from './users-query'

describe('parseUsersQuery', () => {
  it('uses defaults for an empty query', () => {
    expect(parseUsersQuery({})).toEqual({ filter: {}, page: 1, results: 10 })
  })

  it('parses typed filters and pagination', () => {
    expect(parseUsersQuery({ page: '2', results: '5', status: 'admin', active: 'false', email: 'a@b.c' })).toEqual({
      filter: { status: 'admin', active: false, email: 'a@b.c' },
      page: 2,
      results: 5
    })
    expect(parseUsersQuery({ active: 'true' })?.filter).toEqual({ active: true })
  })

  it.each([
    { page: '0' },
    { page: '-1' },
    { page: 'x' },
    { results: '0' },
    { results: String(MAX_PAGE_SIZE + 1) },
    { status: 'root' },
    { status: ['admin'] },
    { active: 'yes' },
    { email: { $ne: '' } }
  ])('rejects %p', (query) => {
    expect(parseUsersQuery(query)).toBeUndefined()
  })
})
