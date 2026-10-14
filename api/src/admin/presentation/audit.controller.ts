import { Controller, Get, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiDefaultResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { IAuditPage } from '../../../../lib/utils/admin'
import { ErrorResponseModel } from '../../shared/presentation/error-response.model'
import { AuditService } from '../application/audit.service'
import { RequirePermission } from './admin-permission.decorator'
import { AuditPageResponse, ListAuditQueryDto } from './dto/admin.dto'

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
}
