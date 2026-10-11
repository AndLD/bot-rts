import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { IDrive, IFile } from '../../../../lib/utils/interfaces/files'
import { Principal } from '../../auth/application/auth.service'
import { CurrentPrincipal } from '../../auth/presentation/current-principal.decorator'
import { ValidationError } from '../../shared/domain/errors'
import { FilesService } from '../application/files.service'
import { FilePathQueryDto, ListFilesQueryDto, MakeDirectoryDto, WriteFileDto } from './dto/files.dto'
import { toDriveDto, toFileDto } from './file.mapper'

const idPipe = new ParseUUIDPipe({ exceptionFactory: () => new ValidationError('Invalid id') })

// The drives (memory modules) of a bot and the files on them (design §11.4)
@ApiTags('files')
@ApiBearerAuth()
@Controller({ path: 'bots/:botId/drives', version: '1' })
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Get()
  async drives(@CurrentPrincipal() { user }: Principal, @Param('botId', idPipe) botId: string): Promise<IDrive[]> {
    return (await this.files.listDrives(user.id, botId)).map(toDriveDto)
  }

  @Get(':driveId/files')
  async list(
    @CurrentPrincipal() { user }: Principal,
    @Param('botId', idPipe) botId: string,
    @Param('driveId', idPipe) driveId: string,
    @Query() query: ListFilesQueryDto
  ): Promise<IFile[]> {
    return (await this.files.list(user.id, botId, driveId, query.directory)).map((file) => toFileDto(file))
  }

  @Get(':driveId/file')
  async read(
    @CurrentPrincipal() { user }: Principal,
    @Param('botId', idPipe) botId: string,
    @Param('driveId', idPipe) driveId: string,
    @Query() query: FilePathQueryDto
  ): Promise<IFile> {
    return toFileDto(await this.files.read(user.id, botId, driveId, query.path), { withContent: true })
  }

  @Put(':driveId/file')
  async write(
    @CurrentPrincipal() { user }: Principal,
    @Param('botId', idPipe) botId: string,
    @Param('driveId', idPipe) driveId: string,
    @Body() body: WriteFileDto
  ): Promise<IFile> {
    return toFileDto(await this.files.write(user.id, botId, driveId, body.path, body.content))
  }

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
