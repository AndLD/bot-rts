import { Controller, Get, Header, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiDefaultResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { IAuditPage } from '../../../../lib/utils/admin'
import { ErrorResponseModel } from '../../shared/presentation/error-response.model'
import { auditCsv } from '../domain/audit-csv'
import { AuditService } from '../application/audit.service'
import { Audited, RequirePermission } from './admin-permission.decorator'
import { AuditPageResponse, ListAuditQueryDto } from './dto/admin.dto'

const EXPORT_LIMIT = 10_000

@ApiTags('admin')
@ApiDefaultResponse({ type: ErrorResponseModel })
@ApiBearerAuth()
@Controller({ path: 'admin/audit', version: '1' })
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @RequirePermission('audit.read')
  @ApiOkResponse({ type: AuditPageResponse })
  @Get()
  async list(@Query() { page, results, ...filter }: ListAuditQueryDto): Promise<IAuditPage> {
    const { entries, total } = await this.audit.list(filter, { page, pageSize: results })

    return {
      result: entries.map(({ id, at, ...entry }) => ({ _id: id, at: at.getTime(), ...entry })),
      meta: { pagination: { page, results, total } }
    }
  }

  // The filtered trail as CSV, newest first, at most EXPORT_LIMIT lines; exporting is itself audited
  @RequirePermission('audit.export')
  @ApiOkResponse({ description: 'CSV', schema: { type: 'string' } })
  @Audited({ action: 'audit.export' })
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="audit-log.csv"')
  @Get('export')
  async export(@Query() { page: _page, results: _results, ...filter }: ListAuditQueryDto): Promise<string> {
    const { entries } = await this.audit.list(filter, { page: 1, pageSize: EXPORT_LIMIT })

    return auditCsv(entries)
  }
}
