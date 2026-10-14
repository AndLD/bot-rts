import { Controller, Get, Header, Headers, Inject } from '@nestjs/common'
import { ApiExcludeController } from '@nestjs/swagger'
import { Public } from '../../auth/presentation/public.decorator'
import { SkipRateLimit } from '../../ratelimit/presentation/rate-limit.decorator'
import { METRICS_SERVICE, MetricsService } from '../application/metrics.service'

// For the operator's scraper, not for players: guarded by METRICS_TOKEN and left out of the public OpenAPI document
@ApiExcludeController()
@Controller({ path: 'metrics', version: '1' })
export class MetricsController {
  constructor(@Inject(METRICS_SERVICE) private readonly metrics: MetricsService) {}

  @Public()
  @SkipRateLimit()
  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async scrape(@Headers('authorization') authorization: string | undefined): Promise<string> {
    this.metrics.authorize(authorization?.replace(/^Bearer /i, ''))
    return this.metrics.render()
  }
}
