import { Controller, Get, Inject, Param, ParseUUIDPipe, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiDefaultResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import {
  IHeatmap,
  IInspectorBot,
  IInspectorFile,
  IInspectorFileContent,
  IInspectorSearchResult
} from '../../../../lib/utils/admin-inspector'
import { IMapView } from '../../../../lib/utils/interfaces/map'
import { Audited, RequirePermission } from '../../admin/presentation/admin-permission.decorator'
import { AuditDetail } from '../../admin/presentation/admin-request'
import { AuditDetailParam } from '../../admin/presentation/audit-detail.decorator'
import { MapRangeQueryDto, MapViewResponse } from '../../mapview/presentation/map.dto'
import { ValidationError } from '../../shared/domain/errors'
import { ErrorResponseModel } from '../../shared/presentation/error-response.model'
import { InspectorService } from '../application/inspector.service'
import {
  DirectoryQueryDto,
  FilePathQueryDto,
  HeatmapQueryDto,
  HeatmapResponse,
  InspectorBotResponse,
  InspectorFileContentResponse,
  InspectorFileResponse,
  SearchQueryDto,
  SearchResultResponse
} from './dto/inspector.dto'

export const INSPECTOR_SERVICE = Symbol('InspectorService')

const uuid = new ParseUUIDPipe({ exceptionFactory: () => new ValidationError('Invalid id') })

// The Inspector and the world map (design §25.3): read-only. Reading a file is the one read that is audited.
@ApiTags('admin')
@ApiDefaultResponse({ type: ErrorResponseModel })
@ApiBearerAuth()
@Controller({ path: 'admin/inspector', version: '1' })
export class InspectorController {
  constructor(@Inject(INSPECTOR_SERVICE) private readonly inspector: InspectorService) {}

  @RequirePermission('inspector.read')
  @ApiOkResponse({ type: SearchResultResponse, isArray: true })
  @Get('search')
  search(@Query() { q }: SearchQueryDto): Promise<IInspectorSearchResult[]> {
    return this.inspector.search(q)
  }

  @RequirePermission('inspector.read')
  @ApiOkResponse({ type: InspectorBotResponse })
  @Get('bots/:id')
  bot(@Param('id', uuid) id: string): Promise<IInspectorBot> {
    return this.inspector.bot(id)
  }

  @RequirePermission('inspector.read')
  @ApiOkResponse({ type: InspectorFileResponse, isArray: true })
  @Get('bots/:id/drives/:driveId/files')
  files(
    @Param('id', uuid) id: string,
    @Param('driveId', uuid) driveId: string,
    @Query() { dir }: DirectoryQueryDto
  ): Promise<IInspectorFile[]> {
    return this.inspector.listFiles(id, driveId, dir?.replace(/^\/+|\/+$/g, '') || null)
  }

  // A player's files are private: opening one needs its own permission and leaves an audit entry with the path
  @RequirePermission('inspector.files.read')
  @ApiOkResponse({ type: InspectorFileContentResponse })
  @Audited({ action: 'inspector.read-file', targetType: 'file' })
  @Get('bots/:id/drives/:driveId/file')
  async file(
    @AuditDetailParam() detail: AuditDetail,
    @Param('id', uuid) id: string,
    @Param('driveId', uuid) driveId: string,
    @Query() { path }: FilePathQueryDto
  ): Promise<IInspectorFileContent> {
    detail.targetId = `${id}/${driveId}/${path}`

    return this.inspector.readFile(id, driveId, path)
  }

  @RequirePermission('map.read')
  @ApiOkResponse({ type: MapViewResponse })
  @Get('map')
  map(@Query() range: MapRangeQueryDto): Promise<IMapView> {
    return this.inspector.worldView(range)
  }

  @RequirePermission('map.read')
  @ApiOkResponse({ type: HeatmapResponse })
  @Get('heatmap')
  heatmap(@Query() { kind, bucket, ...range }: HeatmapQueryDto): Promise<IHeatmap> {
    return this.inspector.heatmap({ kind, bucket, range })
  }
}
