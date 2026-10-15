import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiDefaultResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags
} from '@nestjs/swagger'
import { IDrive, IFile } from '../../../../lib/utils/interfaces/files'
import { ViewAsAudited } from '../../viewas/presentation/view-as.decorator'
import { Principal } from '../../auth/application/auth.service'
import { CurrentPrincipal } from '../../auth/presentation/current-principal.decorator'
import { ValidationError } from '../../shared/domain/errors'
import { ErrorResponseModel } from '../../shared/presentation/error-response.model'
import { FilesService } from '../application/files.service'
import { DriveResponse, FileResponse } from './dto/files.response'
import { FilePathQueryDto, ListFilesQueryDto, MakeDirectoryDto, WriteFileDto } from './dto/files.dto'
import { toDriveDto, toFileDto } from './file.mapper'
import { RequireScope } from '../../apikeys/presentation/scope.decorator'

const idPipe = new ParseUUIDPipe({ exceptionFactory: () => new ValidationError('Invalid id') })

// The drives (memory modules) of a bot and the files on them (design §11.4)
@ApiTags('files')
@ApiDefaultResponse({ type: ErrorResponseModel })
@ApiBearerAuth()
@Controller({ path: 'bots/:botId/drives', version: '1' })
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @ApiOkResponse({ type: [DriveResponse] })
  @RequireScope('read')
  @Get()
  async drives(@CurrentPrincipal() { user }: Principal, @Param('botId', idPipe) botId: string): Promise<IDrive[]> {
    return (await this.files.listDrives(user.id, botId)).map(toDriveDto)
  }

  @ApiOkResponse({ type: [FileResponse] })
  @RequireScope('read')
  @Get(':driveId/files')
  async list(
    @CurrentPrincipal() { user }: Principal,
    @Param('botId', idPipe) botId: string,
    @Param('driveId', idPipe) driveId: string,
    @Query() query: ListFilesQueryDto
  ): Promise<IFile[]> {
    return (await this.files.list(user.id, botId, driveId, query.directory)).map((file) => toFileDto(file))
  }

  @ApiOkResponse({ type: FileResponse })
  @RequireScope('read')
  @ViewAsAudited('files.read')
  @Get(':driveId/file')
  async read(
    @CurrentPrincipal() { user }: Principal,
    @Param('botId', idPipe) botId: string,
    @Param('driveId', idPipe) driveId: string,
    @Query() query: FilePathQueryDto
  ): Promise<IFile> {
    return toFileDto(await this.files.read(user.id, botId, driveId, query.path), { withContent: true })
  }

  @ApiOkResponse({ type: FileResponse })
  @RequireScope('files')
  @Put(':driveId/file')
  async write(
    @CurrentPrincipal() { user }: Principal,
    @Param('botId', idPipe) botId: string,
    @Param('driveId', idPipe) driveId: string,
    @Body() body: WriteFileDto
  ): Promise<IFile> {
    return toFileDto(await this.files.write(user.id, botId, driveId, body.path, body.content))
  }

  @ApiNoContentResponse()
  @RequireScope('files')
  @Delete(':driveId/file')
  @HttpCode(204)
  async remove(
    @CurrentPrincipal() { user }: Principal,
    @Param('botId', idPipe) botId: string,
    @Param('driveId', idPipe) driveId: string,
    @Query() query: FilePathQueryDto
  ): Promise<void> {
    await this.files.remove(user.id, botId, driveId, query.path)
  }

  @ApiCreatedResponse({ type: FileResponse })
  @RequireScope('files')
  @Post(':driveId/directories')
  async makeDirectory(
    @CurrentPrincipal() { user }: Principal,
    @Param('botId', idPipe) botId: string,
    @Param('driveId', idPipe) driveId: string,
    @Body() body: MakeDirectoryDto
  ): Promise<IFile> {
    return toFileDto(await this.files.makeDirectory(user.id, botId, driveId, body.path))
  }
}
