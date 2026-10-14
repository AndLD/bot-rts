import { Prisma, TerminalLog as LogRow, TerminalSession as SessionRow } from '@prisma/client'
import { TERMINAL_LOG_KIND } from '../../../../lib/utils/interfaces/terminal'
import { TerminalSessionRepository } from '../application/terminal-session.repository'
import { TerminalLogEntry, TerminalSession } from '../domain/terminal-session'

const toSession = (row: SessionRow): TerminalSession => ({ ...row })

const toEntry = (row: LogRow): TerminalLogEntry => ({ ...row, kind: row.kind as TERMINAL_LOG_KIND })

export class PrismaTerminalSessionRepository implements TerminalSessionRepository {
  constructor(private readonly db: Prisma.TransactionClient) {}

  async add(session: TerminalSession): Promise<void> {
    await this.db.terminalSession.create({ data: session })
  }

  async findById(id: string): Promise<TerminalSession | null> {
    const row = await this.db.terminalSession.findUnique({ where: { id } })
    return row && toSession(row)
  }

  async findLatestOfBot(botId: string): Promise<TerminalSession | null> {
    const row = await this.db.terminalSession.findFirst({
      where: { botId },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }]
    })
    return row && toSession(row)
  }

  async close(id: string, endedAt: Date): Promise<void> {
    await this.db.terminalSession.update({ where: { id }, data: { endedAt } })
  }

  async appendLog(entry: TerminalLogEntry): Promise<void> {
    await this.db.terminalLog.create({ data: entry })
  }

  async appendLogs(entries: readonly TerminalLogEntry[]): Promise<void> {
    await this.db.terminalLog.createMany({ data: [...entries] })
  }

  async listLogsOfBot(botId: string, limit: number): Promise<TerminalLogEntry[]> {
    const rows = await this.db.terminalLog.findMany({
      where: { botId },
      orderBy: [{ at: 'desc' }, { id: 'desc' }],
      take: limit
    })
    return rows.reverse().map(toEntry)
  }

  async deleteLogsOlderThan(kinds: readonly TERMINAL_LOG_KIND[], before: Date): Promise<void> {
    await this.db.terminalLog.deleteMany({ where: { kind: { in: [...kinds] }, at: { lt: before } } })
  }

  async deleteOldestOrdinaryLogs(botId: string, keep: number): Promise<void> {
    const ordinary = { botId, kind: { not: TERMINAL_LOG_KIND.SECURITY } }
    const [newestKept] = await this.db.terminalLog.findMany({
      where: ordinary,
      orderBy: [{ at: 'desc' }, { id: 'desc' }],
      skip: keep - 1,
      take: 1
    })
    if (newestKept) {
      await this.db.terminalLog.deleteMany({
        where: { ...ordinary, OR: [{ at: { lt: newestKept.at } }, { at: newestKept.at, id: { lt: newestKept.id } }] }
      })
    }
  }
}
