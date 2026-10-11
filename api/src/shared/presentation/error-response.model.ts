import { ApiProperty } from '@nestjs/swagger'
import { ErrorCode } from '../../../../lib/utils/error-codes'
import { ErrorResponse } from './error-response'

// The body of every failed request (documented once, used as the default response of the controllers)
export class ErrorResponseModel implements ErrorResponse {
  @ApiProperty({ example: 403 })
  statusCode!: number

  @ApiProperty({ enum: Object.values(ErrorCode), description: 'Stable machine-readable code; clients branch on it' })
  code!: string

  @ApiProperty({ description: 'The human-readable message' })
  error!: string
}
