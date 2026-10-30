import { healthResponseSchema, HealthResponse } from '@bazak/contracts';
import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly service: HealthService) {}

  @Get()
  getHealth(): HealthResponse {
    return healthResponseSchema.parse(this.service.getStatus());
  }
}
