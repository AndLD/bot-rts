import { auditCsv } from './audit-csv'
import { AuditEntry } from './audit-entry'

const entry = (overrides: Partial<AuditEntry> = {}): AuditEntry => ({
  id: 'e1',
  at: new Date('2026-06-01T12:00:00.000Z'),
  actorId: 'a1',
  actorRole: 'admin',
  action: 'players.ban',
  outcome: 'success',
  targetType: 'player',
  targetId: 'p1',
  reason: 'spam',
  before: { status: 'user' },
  after: { status: 'banned' },
  ip: '1.2.3.4',
  requestId: 'req-1',
  apiKeyId: null,
  ...overrides
})

describe('auditCsv', () => {
  it('has a header and a row per entry', () => {
    const csv = auditCsv([entry()])

    expect(csv.split('\n')).toEqual([
      'time,actor,role,action,outcome,target type,target,reason,before,after,ip,request,api key',
      '2026-06-01T12:00:00.000Z,a1,admin,players.ban,success,player,p1,spam,"{""status"":""user""}","{""status"":""banned""}",1.2.3.4,req-1,',
      ''
    ])
  })

  it('leaves empty what is missing and quotes commas and line breaks', () => {
    const csv = auditCsv([
      entry({ targetType: null, targetId: null, before: null, after: undefined, reason: 'a, b\nc' })
    ])

    expect(csv.split('\n')[1]).toBe(
      '2026-06-01T12:00:00.000Z,a1,admin,players.ban,success,,,"a, b\nc",,,1.2.3.4,req-1,'.split('\n')[0]
    )
    expect(csv).toContain('"a, b\nc"')
  })

  it('makes a cell that looks like a formula plain text', () => {
    const csv = auditCsv([
      entry({ reason: '=HYPERLINK("http://x")' }),
      entry({ reason: '+1' }),
      entry({ reason: '@cmd' })
    ])

    expect(csv).toContain(`"'=HYPERLINK(""http://x"")"`)
    expect(csv).toContain(",'+1,")
    expect(csv).toContain(",'@cmd,")
  })

  it('names the API key that made the call', () => {
    expect(auditCsv([entry({ apiKeyId: 'key-1' })]).split('\n')[1]).toMatch(/,req-1,key-1$/)
  })

  it('is only the header for an empty trail', () => {
    expect(auditCsv([]).trim().split('\n')).toHaveLength(1)
  })
})
